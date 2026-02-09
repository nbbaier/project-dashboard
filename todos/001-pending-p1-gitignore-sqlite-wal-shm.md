---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, configuration]
dependencies: []
---

# Fix .gitignore to exclude SQLite WAL/SHM files

## Problem Statement

The `.gitignore` excludes `local.db` but not the WAL and SHM journal files (`local.db-wal`, `local.db-shm`) that SQLite creates when `PRAGMA journal_mode = WAL` is enabled. These files contain recent transaction data and could be accidentally committed.

## Findings

- **Source:** security-sentinel agent
- **Severity:** P1 (trivial fix, prevents data leak)
- **File:** `.gitignore`
- **Evidence:** `PRAGMA journal_mode = WAL` is set in `src/server/db/client.ts:12`, which creates `-wal` and `-shm` files alongside the database.

## Proposed Solutions

### Option A: Wildcard pattern (Recommended)
Change `local.db` to `local.db*` in `.gitignore`.
- **Pros:** Catches all SQLite journal files with one pattern
- **Cons:** None
- **Effort:** Trivial (1 line change)
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `.gitignore`

## Acceptance Criteria

- [ ] `.gitignore` uses `local.db*` pattern
- [ ] `local.db-wal` and `local.db-shm` are excluded by `git check-ignore`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
