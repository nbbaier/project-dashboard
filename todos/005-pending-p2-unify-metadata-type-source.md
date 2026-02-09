---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, quality, typescript]
dependencies: []
---

# Derive ProjectMetadata type from Zod schema (single source of truth)

## Problem Statement

`ProjectMetadata` is defined twice: as a TypeScript interface in `schema.ts` (lines 22-45) and as a Zod schema in `validators.ts` (lines 23-42). These can drift apart silently. Adding a field to one but not the other will not be caught at compile time because `.passthrough()` on the Zod schema accepts unknown fields, and `$type<>()` on Drizzle is compile-time only.

## Findings

- **Source:** kieran-typescript-reviewer, pattern-recognition (2 agents)
- **Severity:** P2 (silent drift risk that compounds over time)
- **Files:** `src/server/db/schema.ts:22-45`, `src/server/db/validators.ts:23-42`

## Proposed Solutions

### Option A: Derive type from Zod (Recommended)
In `validators.ts`: `export type ProjectMetadata = z.infer<typeof projectMetadataSchema>`. Import into `schema.ts` for `$type<>()`.
- **Pros:** Single source of truth; Zod drives both runtime and compile-time
- **Cons:** Moves the canonical type to validators
- **Effort:** Small
- **Risk:** None

### Option B: Type assertion to verify alignment
Add `const _check: ProjectMetadata = {} as z.infer<typeof projectMetadataSchema>` to catch drift at compile time.
- **Pros:** Keeps both definitions; fails on drift
- **Cons:** Extra boilerplate; still two definitions
- **Effort:** Trivial
- **Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/schema.ts`, `src/server/db/validators.ts`

## Acceptance Criteria

- [ ] `ProjectMetadata` type has a single source of truth
- [ ] Adding a field to only one definition causes a compile error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
