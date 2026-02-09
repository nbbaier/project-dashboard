---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, configuration]
dependencies: []
---

# Make server port configurable via environment variable

## Problem Statement

Port 3001 is hardcoded in `src/server/index.ts`. Should be configurable via `PORT` env var before Slice 3 adds the full API.

## Findings

- **Source:** pattern-recognition-specialist (Low)
- **File:** `src/server/index.ts:19`

## Proposed Solutions

```typescript
export default { port: Number(process.env.PORT ?? 3001), hostname: "127.0.0.1", fetch: app.fetch };
```

## Acceptance Criteria

- [ ] Port configurable via `PORT` environment variable
- [ ] Defaults to 3001 when not set

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
