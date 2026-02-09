---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, architecture, performance]
dependencies: []
---

# Refactor client.ts: batch PRAGMAs and remove top-level await side effects

## Problem Statement

`client.ts` executes 4 sequential top-level `await` PRAGMA calls at import time. This causes: (1) import side effects that make testing harder, (2) 4 separate round-trips instead of 1 batch, (3) obscure "module failed to load" errors if any PRAGMA fails.

## Findings

- **Source:** kieran-typescript-reviewer, pattern-recognition, architecture-strategist, performance-oracle (4 agents)
- **Severity:** P2 (impacts testability for Slice 2, minor perf for remote Turso)
- **File:** `src/server/db/client.ts:11-14`

## Proposed Solutions

### Option A: Batch PRAGMAs with `client.batch()` (Recommended)
Replace 4 sequential `execute` calls with one `client.batch()`.
- **Pros:** 4 round-trips → 1; still module-level init
- **Cons:** Still has import side effects
- **Effort:** Trivial
- **Risk:** None

### Option B: Factory function + lazy singleton
Wrap initialization in `createDb()`, export lazy accessor.
- **Pros:** Full testability; clean injection point for tests
- **Cons:** Slightly more complex API surface
- **Effort:** Small
- **Risk:** Low

### Option C: Both (batch + factory)
Batch PRAGMAs AND use a factory function.
- **Pros:** Best of both worlds
- **Cons:** More refactoring
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/client.ts`

## Acceptance Criteria

- [ ] PRAGMAs execute in a single batch call
- [ ] Tests can import DB module without triggering real DB calls (if factory approach chosen)
- [ ] Cold start latency reduced for remote Turso connections

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
