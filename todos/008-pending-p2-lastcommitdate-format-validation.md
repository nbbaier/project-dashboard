---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, data-integrity, validation]
dependencies: []
---

# Add ISO 8601 format validation for lastCommitDate

## Problem Statement

`lastCommitDate` is stored as `text` while all other timestamps are integers. The Zod validator only checks `z.string().min(1)` — no format enforcement. The index on this column produces correct ordering only for ISO 8601 strings. A single non-ISO value will silently corrupt sort order.

## Findings

- **Source:** performance-oracle, data-integrity-guardian (2 agents)
- **Severity:** P2 (needed before Slice 2 scanner writes this column)
- **Files:** `src/server/db/validators.ts:9`, `src/server/db/schema.ts:55`

## Proposed Solutions

### Option A: Zod datetime validation (Recommended)
```typescript
lastCommitDate: z.iso.datetime(),
```
- **Pros:** Strict ISO 8601 enforcement; built-in Zod v4 method
- **Cons:** May be too strict if git dates are non-standard
- **Effort:** Trivial
- **Risk:** Low

### Option B: Regex validation
```typescript
lastCommitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
```
- **Pros:** More lenient; handles timezone variations
- **Cons:** Less precise than ISO parser
- **Effort:** Trivial
- **Risk:** Low

### Option C: Convert to integer timestamp
Store as unix epoch integer like all other timestamps.
- **Pros:** Eliminates format risk entirely; consistent with schema
- **Cons:** Larger change; need to convert at scanner boundary
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/validators.ts`

## Acceptance Criteria

- [ ] `lastCommitDate` validated for ISO 8601 format
- [ ] Non-ISO strings rejected at validation boundary

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
