---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security, configuration]
dependencies: []
---

# Add startup validation for DATABASE_AUTH_TOKEN with remote URLs

## Problem Statement

`client.ts` reads `DATABASE_AUTH_TOKEN` from environment with no validation. If `DATABASE_URL` points to a remote Turso instance but the auth token is missing, the client will attempt an unauthenticated connection, potentially exposing connection details in error logs.

## Findings

- **Source:** security-sentinel agent (M1)
- **Severity:** P2
- **File:** `src/server/db/client.ts:7-8`

## Proposed Solutions

### Option A: Guard on URL protocol (Recommended)
If `DATABASE_URL` starts with `libsql://` or `https://`, require `DATABASE_AUTH_TOKEN` to be present. Fail fast at startup.
- **Pros:** Clear error message; prevents silent misconfiguration
- **Cons:** Slightly more code
- **Effort:** Small
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/client.ts`

## Acceptance Criteria

- [ ] Missing auth token with remote URL throws clear error at startup
- [ ] Local file URLs work without auth token

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
