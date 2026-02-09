---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, security]
dependencies: []
---

# Bind server to 127.0.0.1 instead of 0.0.0.0

## Problem Statement

The Bun server export does not specify `hostname`, so Bun defaults to `0.0.0.0` — listening on all network interfaces. For a local dev tool that indexes local git repos and filesystem paths, this exposes the API to the LAN.

## Findings

- **Source:** security-sentinel (Low)
- **Severity:** P2 (low risk now with only health endpoint, but critical before Slice 3 adds data endpoints)
- **File:** `src/server/index.ts:19`

## Proposed Solutions

### Option A: Add hostname (Recommended)
```typescript
export default { port: 3001, hostname: "127.0.0.1", fetch: app.fetch };
```
- **Pros:** Trivial fix, prevents LAN exposure
- **Cons:** None
- **Effort:** Trivial (1 property)
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/index.ts`

## Acceptance Criteria

- [ ] Server binds to `127.0.0.1` only
- [ ] Not accessible from other machines on the LAN

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | Bun defaults to 0.0.0.0 when hostname not specified |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
