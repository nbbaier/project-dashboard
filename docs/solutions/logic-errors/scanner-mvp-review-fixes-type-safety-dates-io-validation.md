---
title: "Scanner MVP Code Review: 12 Findings Across Date Handling, Type Safety, and File I/O"
date: "2026-02-09"
category: "logic-errors"
tags: ["type-safety", "date-handling", "file-io", "zod-validation", "simple-git", "drizzle-orm", "lstat", "symlink-safety"]
module: "scanner"
severity: "high"
symptoms:
  - "ScanResult interface had duplicate 'skipped' field and missing 'updated' field"
  - "simple-git dates like '2026-02-09 11:54:23 -0600' failed z.iso.datetime() validation"
  - "Drizzle onConflictDoUpdate can't distinguish inserts from updates"
  - "readFileSafely called stat() twice per file (double-stat)"
  - "stat() follows symlinks — security risk for untrusted repo contents"
  - "ScanOptions type hand-written separately from Zod schema"
  - "package.json read 3 times per scanned repository"
  - "CLI threw raw Zod errors on invalid input"
  - ".passthrough() on metadata schema allowed arbitrary extra fields"
related:
  - "docs/solutions/database-issues/drizzle-sqlite-foundation-review-fixes.md"
  - "docs/plans/2026-02-09-feat-scanner-mvp-plan.md"
---

# Scanner MVP Code Review Fixes

Multi-agent code review of PR #2 (`feat/scanner-mvp`) found 12 issues across 4 files. Six specialized agents (TypeScript reviewer, security sentinel, performance oracle, architecture strategist, pattern recognition, code simplicity) ran in parallel and findings were deduplicated.

## Root Cause

Seven interconnected issues from incomplete type safety, data format mismatches, and inefficient I/O patterns:

1. **Copy-paste error in ScanResult** — `skipped` field duplicated, `updated` missing. Later merged `inserted`/`updated` into `saved` since Drizzle's `onConflictDoUpdate` can't distinguish the two.
2. **Date format incompatibility** — `simple-git` returns `2026-02-09 11:54:23 -0600` but schema expected ISO 8601 via `z.iso.datetime()`. Also broke lexicographic sorting in SQLite.
3. **Redundant stat calls** — `readFileSafely` called `fileExists()` (which calls `stat()`) then `stat()` again for size. Also `stat()` follows symlinks; `lstat()` doesn't.
4. **Hand-written types duplicating Zod schemas** — `ScanOptions` interface and implicit `extractGitData` return type forced verbose `NonNullable<Awaited<ReturnType<...>>>`.
5. **Repeated file reads** — `package.json` read 3x per repo across `inferDescription`, `detectNodeFrameworks`, `inferDeploymentStatus`.
6. **Unformatted CLI errors** — `scanOptionsSchema.parse()` threw raw Zod errors.
7. **Overly permissive schema** — `.passthrough()` on `projectMetadataSchema` silently accepted arbitrary fields.

## Solution

### P1: ScanResult interface (scanner.ts)

```typescript
// Before (broken)
interface ScanResult {
  inserted: number;
  skipped: number;
  skipped: number;  // duplicate!
  errored: number;
  total: number;
}

// After
interface ScanResult {
  saved: number;     // merged inserted+updated — upsert can't distinguish
  skipped: number;
  errored: number;
  total: number;
}
```

### P2: Date normalization (project-data.ts)

Normalize `simple-git` dates to ISO 8601 at the extraction boundary:

```typescript
return {
  lastCommitDate: new Date(log.latest.date).toISOString(),
  recentCommits: log.all.map((entry) => ({
    date: new Date(entry.date).toISOString(),
    message: entry.message,
  })),
};
```

### P2: Single lstat() call (project-data.ts)

Replace double-stat with single `lstat()` for both file check and size check. `lstat()` doesn't follow symlinks.

```typescript
async function readFileSafely(filePath: string, maxLines = 1000): Promise<string | null> {
  try {
    const s = await lstat(filePath);
    if (!s.isFile() || s.size > MAX_FILE_SIZE) return null;
    const content = await readFile(filePath, "utf-8");
    return content.split("\n").slice(0, maxLines).join("\n");
  } catch {
    return null;
  }
}
```

### P2: Derive types from Zod (validators.ts, scanner.ts, project-data.ts)

```typescript
// validators.ts — export derived type
export type ScanOptions = z.infer<typeof scanOptionsSchema>;

// project-data.ts — explicit GitData interface replaces NonNullable<Awaited<ReturnType<...>>>
interface GitData {
  lastCommitDate: string;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  recentCommits: { date: string; message: string }[];
  contributors: string[];
}

async function extractGitData(git: ReturnType<typeof simpleGit>): Promise<GitData | null> { ... }
```

### P2: Cache package.json reads (project-data.ts)

Read once in `extractMetadata`, pass to all consumers:

```typescript
async function extractMetadata(repoPath, name, gitData, gitRemote, errors): Promise<ProjectMetadata> {
  const pkgContent = await readFileSafely(join(repoPath, "package.json"));
  description = await inferDescription(repoPath, name, pkgContent);
  techStack = await detectTechStack(repoPath, pkgContent);
  deploymentStatus = await inferDeploymentStatus(repoPath, pkgContent);
  // ...
}
```

### P2: CLI error handling (cli/scan.ts)

```typescript
const result = scanOptionsSchema.safeParse(rawOptions);
if (!result.success) {
  console.error("Invalid options:");
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}
await scan(result.data);
```

### P2: Strict schema (validators.ts)

```typescript
// Before: .passthrough() allows arbitrary extra fields
export const projectMetadataSchema = z.object({ ... }).passthrough();

// After: .strict() rejects unknown fields
export const projectMetadataSchema = z.object({ ... }).strict();
```

### P3: Minor fixes (scanner.ts)

- Indexed `for` loops replaced with `for...of` + `.entries()`
- Fork badge trailing space `"[Own] "` → `"[Own]"` with `.padEnd(7)` for alignment

## Files Modified

| File | Changes |
|------|---------|
| `src/scanner/scanner.ts` | ScanResult fix, `saved` counter, `for...of`, fork badge, derive ScanOptions |
| `src/scanner/project-data.ts` | lstat, readFileSafely, GitData interface, date normalization, package.json caching, optional chaining on regex captures |
| `src/server/db/validators.ts` | `.strict()`, `ScanOptions` type export |
| `cli/scan.ts` | `safeParse` + formatted error output |

## Prevention Strategies

### Normalize at boundaries
When importing data from external libraries (`simple-git`, APIs), convert to canonical formats immediately after retrieval — before any validation or storage.

### Derive types from schemas
Always use `z.infer<typeof schema>` instead of hand-writing duplicate interfaces. The Zod schema is the single source of truth.

### Single I/O pass-through
Read files once, pass content as parameters. Don't re-read inside helper functions.

### Use lstat() for untrusted paths
`stat()` follows symlinks — a symlink in a scanned repo could point outside the repo. `lstat()` checks the link itself.

### Strict validation at boundaries
Use `.strict()` on Zod schemas at system boundaries (CLI, API). Only use `.passthrough()` when unknown fields are intentionally allowed.

### safeParse for user-facing input
Use `safeParse()` at CLI/API boundaries and format errors for humans. Reserve `parse()` (which throws) for internal code where invalid data is a bug.

## Best Practices Checklist

- [ ] All types derived from Zod schemas via `z.infer<>`
- [ ] External API outputs normalized at retrieval point (dates, URLs)
- [ ] File reads cached and passed through extraction pipeline
- [ ] `lstat()` used for file checks in untrusted directories
- [ ] Zod schemas use `.strict()` at system boundaries
- [ ] CLI validates with `safeParse()` and formats errors
- [ ] Functions have explicit return types for unions (`T | null`)
- [ ] `for...of` preferred over indexed `for` loops
- [ ] Regex capture groups accessed with optional chaining (`match?.[1]`)
