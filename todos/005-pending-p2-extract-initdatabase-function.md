---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, architecture, quality]
dependencies: []
---

# Extract initDatabase() function from top-level await in client.ts

## Problem Statement

Four `await client.execute()` PRAGMA calls run at module import time. Any module that imports `db` (directly or transitively) triggers real database I/O. This makes unit testing hard (can't import without a live DB), provides no structured error handling on startup failure, and will become a friction point as the codebase grows.

## Findings

- **Source:** kieran-typescript-reviewer (Medium), pattern-recognition (Medium), data-integrity-guardian (Medium), architecture-strategist (4 agents)
- **Severity:** P2 (testability concern for Slice 2+)
- **File:** `src/server/db/client.ts:20-23`

## Proposed Solutions

### Option A: Named init function (Recommended)
```typescript
export const db = drizzle(client, { schema });

export async function initDatabase(): Promise<void> {
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA synchronous = NORMAL");
  await client.execute("PRAGMA cache_size = -8000");
}
```
Call `await initDatabase()` from `index.ts` at server startup.
- **Pros:** Testable; clear failure point; db exportable without side effects
- **Cons:** One extra call at startup
- **Effort:** Small
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/client.ts`, `src/server/index.ts`

## Acceptance Criteria

- [ ] PRAGMAs do not execute at module import time
- [ ] `db` can be imported in tests without triggering DB I/O
- [ ] Server startup explicitly calls `initDatabase()`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | Top-level await couples module loading to DB availability |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
