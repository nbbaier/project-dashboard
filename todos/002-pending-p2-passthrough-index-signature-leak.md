---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, typescript, quality]
dependencies: []
---

# Fix .passthrough() leaking index signature into ProjectMetadata type

## Problem Statement

`projectMetadataSchema` uses `.passthrough()`, which makes `z.infer` produce `{ ...knownFields } & { [k: string]: unknown }`. This index signature propagates into the `$type<ProjectMetadata>()` annotation on the Drizzle column, meaning arbitrary key access on metadata silently resolves to `unknown` instead of being a compile error — the exact problem the old explicit `[key: string]: unknown` interface had.

## Findings

- **Source:** kieran-typescript-reviewer (Medium), security-sentinel (Medium), architecture-strategist (Medium), code-simplicity-reviewer (4 agents)
- **Severity:** P2 (undermines type safety on metadata access)
- **Files:** `src/server/db/validators.ts:42-44`, `src/server/db/schema.ts:42`

## Proposed Solutions

### Option A: Define ProjectMetadata as explicit interface (Recommended)
Move the type back to an explicit TypeScript interface (without the index signature). Keep the Zod schema with `.passthrough()` for runtime validation only.
- **Pros:** Strict compile-time access; runtime extensibility preserved
- **Cons:** Two definitions that could drift (mitigated by a compile-time assertion)
- **Effort:** Small
- **Risk:** None

### Option B: Use .strip() instead of .passthrough()
Replace `.passthrough()` with `.strip()` on the Zod schema. Unknown keys are dropped at runtime.
- **Pros:** Single source of truth; strict at both runtime and compile-time
- **Cons:** Scanner can't pass through unknown metadata fields
- **Effort:** Trivial
- **Risk:** Low (may lose data if scanner evolves metadata shape)

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/validators.ts`, `src/server/db/schema.ts`

## Acceptance Criteria

- [ ] `ProjectMetadata` type does NOT include an index signature
- [ ] Accessing an unknown key on `project.metadata` produces a compile error
- [ ] Runtime validation still accepts unknown keys if .passthrough() is kept

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | Zod v4 z.infer of .passthrough() includes index signature in the type |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
