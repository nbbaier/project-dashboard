---
title: "Scanner MVP"
type: feat
date: 2026-02-09
slice: 2 of 5
---

# Scanner MVP

## Overview

Port the Rails scanning engine (ProjectScanner + ProjectData + rake tasks) to TypeScript. This is slice 2 of 5 — the first slice that produces user-visible value by populating the database with real project data from local git repositories.

The Rails codebase has three overlapping pieces:

- `lib/project_scanner.rb` (204 lines) — recursive git repo discovery + date filtering + DB persistence
- `lib/project_data.rb` (398 lines) — metadata extraction (git commands, tech stack, descriptions, state)
- `bin/index_all_projects` (324 lines) — standalone indexer with marker-based detection (overlapping logic)

The port consolidates all three into two modules + a CLI entry point.

## Problem Statement / Motivation

The database schema exists (slice 1) but has no data. Without the scanner, the dashboard has nothing to show. The scanner is also the primary validation that `simple-git`, `fast-glob`, and the Drizzle upsert pattern work correctly with real repositories.

## Proposed Solution

### New Files

```
src/scanner/
├── scanner.ts          # Repo discovery + orchestration + DB persistence
└── project-data.ts     # Metadata extraction per repo (git ops inlined here)

cli/
└── scan.ts             # CLI entry point (single file, single command)
```

Three files. No wrapper layers, no `commands/` directory, no separate git helpers module.

The scanner is **not** a server concern — it runs from the CLI and touches the DB directly. It lives in `src/scanner/`, not `src/server/`.

### New Dependencies

| Package      | Purpose                    | Replaces                |
| ------------ | -------------------------- | ----------------------- |
| `simple-git` | Git operations             | backtick shell commands |
| `fast-glob`  | Recursive `.git` discovery | `Find.find`             |
| `commander`  | CLI framework              | Rake tasks              |

### Bug Fixes from Rails

1. **Hardcoded cutoff date** (`project_data.rb:51`): `cutoff_date = "2025-03-10"` is hardcoded instead of computed. Fix: compute from current date minus configurable `commitCountMonths` (default 8).
2. **Missing `is_fork` attribute**: `ProjectData` has `attr_accessor` for `path, name, last_commit_date, last_commit_message, metadata` but NOT `is_fork`. The scanner reads `project.is_fork` which always returns `nil` (falsy). Fix: implement fork detection by comparing remote origin URL owner against a configured GitHub username. Note: only handles GitHub remotes — repos on other hosts or with no remote default to `false` (not a fork).
3. **Shell pipe in git command** (`project_data.rb:56`): `git log --format='%an' | sort -u` relies on shell piping. Fix: use `simpleGit().log()` + `new Set()` for unique contributors.
4. **Consolidate duplicate logic**: `bin/index_all_projects` has its own description extraction, type inference, and link extraction that overlaps with `ProjectData`. Merge the useful bits (better type inference with more languages, link extraction from package.json/gemspec) into the single `project-data.ts`.

## Technical Approach

### Type Design — derive from Zod, single source of truth

The existing `insertProjectSchema` in `validators.ts` has a `null` vs `undefined` mismatch (`lastCommitMessage` is `z.string().optional()` but scanner output needs `nullable`). Fix by extending the insert schema:

```typescript
// In validators.ts — add this
export const scannedProjectSchema = insertProjectSchema.extend({
  metadata: projectMetadataSchema,
  isFork: z.boolean(),                    // required for scanner output
  lastCommitMessage: z.string().nullable(), // scanner produces null, not undefined
});

export type ScannedProject = z.infer<typeof scannedProjectSchema>;
```

Do **not** hand-write a separate `ScannedProject` interface — derive it from the schema so there's a single source of truth. The Zod schema validates at the CLI boundary (incoming options) and before DB persistence.

### CLI options — validate with Zod at the boundary

Commander gives you strings. Parse and coerce CLI input through Zod:

```typescript
const scanOptionsSchema = z.object({
  root: z.string().min(1).transform(p => p.replace(/^~/, homedir())),
  cutoffDays: z.coerce.number().int().positive().default(240),
  dryRun: z.boolean().default(false),
  githubUser: z.string().optional(),
});
```

This is the system boundary — the one place Zod validation earns its keep. Inside the scanner, trust TypeScript's type system for data you construct yourself.

### `src/scanner/project-data.ts` — Metadata Extraction

Port of `ProjectData`. Takes a repo path + `githubUser`, returns a `ScannedProject` or `null`. Git operations use `simple-git` directly — no separate wrapper module.

```typescript
async function extractProjectData(
  repoPath: string,
  githubUser?: string,
): Promise<ScannedProject | null>
```

**Error handling contract:**
- Returns `null` only when the repo is fundamentally unreadable (no `.git` dir, zero commits).
- For partial failures (e.g., can't read README, git remote fails), accumulates errors into `metadata.errors` and returns a valid `ScannedProject` with whatever data it could gather. Mirrors the Rails approach where `@errors` is populated but the result is still usable.
- Never throws for expected failures. The scanner wraps each call in try-catch for truly unexpected errors.

Key extraction methods (ported from Ruby):

| Ruby method                  | TS function                           | Notes                                                          |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `extract_git_data`           | Inline `simpleGit()` calls            | No shell pipes, no wrapper module                              |
| `detect_tech_stack`          | `detectTechStack(path)`               | File existence checks via `Bun.file().exists()`                |
| `infer_project_type`         | `inferProjectType(techStack)`         | Merge better type list from `bin/index_all_projects`           |
| `infer_description`          | `inferDescription(path)`              | Priority: `.ai/PROJECT_STATUS.md` > `CLAUDE.md` > `README.md` |
| `infer_current_state`        | `inferCurrentState(path, lastCommit)` | TODO.md parsing + commit recency                               |
| `infer_deployment_status`    | `inferDeploymentStatus(path)`         | Dockerfile/Procfile/deploy script checks                       |
| `find_reference_files`       | `findReferenceFiles(path)`            | Glob for `.ai/`, `.cursor/`, `docs/`, `tasks/`                 |
| `check_nested_repos`         | `checkNestedRepos(path)`              | `fast-glob` for nested `.git` dirs                             |
| `count_markdown_files`       | `countMarkdownFiles(path, dir)`       | Simple glob + count                                            |
| `extract_claude_description` | `extractClaudeDescription(path)`      | Parse first paragraph after YAML frontmatter                   |
| (missing)                    | `detectIsFork(remoteUrl, githubUser)` | **New**: compare remote URL owner vs configured user           |

**Regex porting notes** (from port plan):

- Ruby's `m` flag (dotall) → JS `s` flag
- Ruby's `\A`/`\z` → JS `^`/`$` (with no `m` flag, or use appropriate patterns)
- The description regex `content =~ /##\s*(Description|Overview|About|Summary)\s*\n+(.+?)(?=\n##|\z)/m` needs the `s` flag in JS

**Fork detection** (new — GitHub-only, other hosts default to `false`):

```typescript
function detectIsFork(remoteUrl: string | null, githubUser?: string): boolean {
  if (!remoteUrl || !githubUser) return false;
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\//);
  if (!match) return false;
  return match[1].toLowerCase() !== githubUser.toLowerCase();
}
```

Configurable via `GITHUB_USER` env var or `--github-user` CLI flag.

### `src/scanner/scanner.ts` — Orchestrator

Port of `ProjectScanner`. Discovery + filtering + DB persistence.

**Repo discovery** uses `fast-glob`:

```typescript
import fg from "fast-glob";

const gitDirs = await fg("**/.git", {
  cwd: rootPath,
  onlyDirectories: true,
  ignore: ["**/node_modules/**", "**/vendor/**"],
  deep: 10,
  followSymbolicLinks: false,
  absolute: true,
});
// Each result is /abs/path/to/repo/.git → path.dirname() gives repo path
```

This replaces the 60-line `find_all_git_repos` Ruby method with ~5 lines.

**DB persistence** — `onConflictDoUpdate` for atomic upsert:

```typescript
const values = {
  path: project.path,
  name: project.name,
  lastCommitDate: project.lastCommitDate,
  lastCommitMessage: project.lastCommitMessage,
  metadata: project.metadata,
  isFork: project.isFork,
};

await db.insert(projects).values(values).onConflictDoUpdate({
  target: projects.path,
  set: {
    name: values.name,
    lastCommitDate: values.lastCommitDate,
    lastCommitMessage: values.lastCommitMessage,
    metadata: values.metadata,
    isFork: values.isFork,
  },
});
```

Note: `set` must reference the `values` object explicitly — Drizzle's `onConflictDoUpdate` does not implicitly reference the incoming row.

**Processing flow:**
- Iterate repos sequentially
- For each repo: extract data → log progress → upsert (if not dry-run)
- Log skipped repos as they're encountered (don't accumulate into an array)
- Print summary at end with counts (inserted/updated/skipped/errored)

**Console output**: Port the progress reporting (repo count, status badges, summary table). Use simple `console.log`.

### `cli/scan.ts` — CLI Entry Point

Single file for the single command:

```typescript
import { program } from "commander";

program
  .name("project-dashboard")
  .description("Discover and track local git repositories")
  .command("scan")
  .description("Scan for git repositories and update database")
  .option("--root <path>", "Root directory to scan", "~/Code")
  .option("--cutoff-days <days>", "Skip repos with no commits in N days", "240")
  .option("--dry-run", "Scan without saving to database", false)
  .option("--github-user <user>", "GitHub username for fork detection")
  .action(async (rawOptions) => {
    const options = scanOptionsSchema.parse(rawOptions);
    // Wire to scanner.ts
  });

program.parse();
```

When a second command arrives, split into `cli/index.ts` + `cli/commands/`. Not before.

**package.json script**: `"scan": "bun run cli/scan.ts"`

## Acceptance Criteria

### Functional

- [x] `bun run scan` discovers all git repos under `~/Code` (or configured root)
- [x] Repos with no commits within cutoff period are skipped with reason logged
- [x] Each discovered repo has full metadata extracted (tech stack, description, state, contributors, etc.)
- [x] `is_fork` is correctly detected based on GitHub remote URL vs configured username
- [x] Hardcoded cutoff date bug is fixed — commit count period is computed dynamically
- [x] Projects are upserted to SQLite (new repos inserted, existing repos updated)
- [x] `--dry-run` flag scans and reports without touching the database
- [x] Console output shows progress, per-repo status, and final summary with counts
- [x] Invalid/errored repos are skipped gracefully with error logged (not crash)

### Technical

- [x] No shell backticks — all git operations via `simple-git`
- [x] No shell piping — unique contributors via `Set`
- [x] `fast-glob` for repo discovery (replaces 60-line recursive traversal)
- [x] Drizzle `onConflictDoUpdate` for atomic upsert (correct `set` references)
- [x] `ScannedProject` type derived from Zod schema (not hand-written interface)
- [x] CLI options validated with Zod at system boundary (coerce strings to correct types)
- [x] `bun x ultracite check` passes clean

## Dependencies & Risks

**Dependencies:**

- Slice 1 (foundation) must be merged to `main` first — schema, client, validators are prerequisites

**Risks:**

1. **`simple-git` API surface** — need to verify `.log()` output format matches what we expect for date parsing. The Ruby code uses `git log --format='%ai|%s|%an'` which returns author date in ISO-ish format. `simple-git`'s `log()` returns structured objects with `.date` as ISO string — should map cleanly.
2. **`fast-glob` on large directory trees** — `~/Code` may have thousands of directories. The `ignore` patterns for `node_modules` and `vendor` are critical for performance. Test with real directory tree.
3. **File I/O volume** — `extractProjectData` reads multiple files per repo (README, CLAUDE.md, package.json, Gemfile, TODO.md, etc.). For 100+ repos this is many stat/read calls. Bun's `Bun.file()` is fast but worth profiling.
4. **Ruby regex → JS regex** — Description extraction regex needs careful porting. The `m` flag difference is the main gotcha.

## References & Research

### Internal References

- Drizzle schema: `src/server/db/schema.ts`
- Zod validators: `src/server/db/validators.ts` (defines `ProjectMetadata` shape — extend here)
- DB client: `src/server/db/client.ts`
- Port plan: `docs/typescript-port-plan.md` (slice 2 section, scanning engine section, known risks)

### Rails Reference

- `~/Code/your-project-dashboard/lib/project_scanner.rb` — 204 lines, repo discovery + orchestration
- `~/Code/your-project-dashboard/lib/project_data.rb` — 398 lines, metadata extraction
- `~/Code/your-project-dashboard/bin/index_all_projects` — 324 lines, standalone indexer (consolidate into above)
- `~/Code/your-project-dashboard/lib/tasks/projects.rake` — CLI config (env vars, defaults)
- `~/Code/your-project-dashboard/app/models/project.rb:67-76` — `create_or_update_from_data` upsert pattern
