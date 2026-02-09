---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, data-integrity]
dependencies: []
---

# Normalize lastCommitDate to UTC Z-suffix to prevent sort order bugs

## Problem Statement

`z.iso.datetime()` accepts both `Z` and `+HH:MM` timezone formats. ISO 8601 strings with different offset formats don't sort correctly lexicographically (`+` sorts after `Z` in ASCII). Since `last_commit_date` is stored as text with a B-tree index, mixed formats will produce incorrect sort ordering.

## Findings

- **Source:** data-integrity-guardian (Medium), architecture-strategist (Low)
- **Severity:** P2 (silent sort bugs are hard to diagnose)
- **File:** `src/server/db/validators.ts:9`

## Proposed Solutions

### Option A: Tighten Zod validator to Z-only (Recommended)
```typescript
lastCommitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
```
- **Pros:** Enforces consistent format at validation boundary
- **Cons:** Scanner must normalize dates to UTC before insert
- **Effort:** Trivial
- **Risk:** Low

### Option B: Convert to integer timestamp
Store as unix epoch integer like all other timestamps. Convert at the scanner boundary.
- **Pros:** Eliminates format risk entirely; consistent with schema
- **Cons:** Larger change; migration impact
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/validators.ts`

## Acceptance Criteria

- [ ] All stored `last_commit_date` values use consistent timezone format
- [ ] B-tree index produces correct chronological ordering

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | ASCII sort: + > Z, breaking ISO 8601 text ordering for mixed offsets |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
