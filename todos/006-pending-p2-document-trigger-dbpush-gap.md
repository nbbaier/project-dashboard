---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, architecture, documentation]
dependencies: []
---

# Document that db:push does not apply updatedAt triggers

## Problem Statement

The `updatedAt` triggers exist only in the migration SQL file. `drizzle-kit push` syncs schema state (tables/indexes) but does not run custom SQL from migration files. Anyone using `db:push` (the current `package.json` script) will get a database without the triggers, and `updatedAt` will silently remain frozen at insert time.

## Findings

- **Source:** architecture-strategist (before merge), data-integrity-guardian
- **Severity:** P2 (silent data correctness issue)
- **Files:** `drizzle/0000_abandoned_mastermind.sql:71-82`, `src/server/db/schema.ts`, `package.json`

## Proposed Solutions

### Option A: Add db:setup script + comment (Recommended)
Add a `db:setup` script to `package.json` that runs `db:push` then applies triggers via a SQL file. Add a comment near the `timestamps` constant in `schema.ts` noting the trigger dependency.
- **Pros:** Single command for correct DB setup; documented
- **Cons:** Slightly more tooling
- **Effort:** Small
- **Risk:** None

### Option B: Use programmatic migrate() instead of db:push
Switch from `db:push` to Drizzle's `migrate()` function which runs the migration SQL files (including triggers).
- **Pros:** Triggers applied automatically; standard migration flow
- **Cons:** Different workflow; need to handle migration state
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `package.json`, `src/server/db/schema.ts` (comment), potentially a new `scripts/setup-db.ts`

## Acceptance Criteria

- [ ] Running the setup/migration process applies both schema and triggers
- [ ] Comment in schema.ts documents the trigger dependency
- [ ] New developer can set up the DB correctly following README/scripts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | db:push only syncs Drizzle-managed schema, not custom SQL |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
