---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# Choose and implement updatedAt auto-update mechanism

## Problem Statement

All 6 tables have `updatedAt` with `DEFAULT (unixepoch())`, but this only fires on INSERT. SQLite has no `ON UPDATE CURRENT_TIMESTAMP`. After any UPDATE, `updatedAt` will remain frozen at the original insert time, breaking any feature that relies on "last modified" ordering.

## Findings

- **Source:** security-sentinel, data-integrity-guardian, pattern-recognition, architecture-strategist (4 agents flagged this)
- **Severity:** P2 (must resolve before Slice 2 — scanner does bulk upserts)
- **Files:** `src/server/db/schema.ts` (all 6 tables), `drizzle/0000_nervous_ronan.sql`

## Proposed Solutions

### Option A: SQLite triggers (Recommended)
Add `AFTER UPDATE` triggers for each table that set `updated_at = unixepoch()`.
- **Pros:** Cannot be bypassed by application code; works for raw SQL too
- **Cons:** 6 trigger definitions to maintain; must be added via migration
- **Effort:** Small
- **Risk:** Low

### Option B: Drizzle `.$onUpdate()`
Use `.$onUpdate(() => new Date())` on column definitions.
- **Pros:** No migration needed; Drizzle-native
- **Cons:** Only fires through Drizzle ORM, not raw SQL; version-dependent
- **Effort:** Trivial
- **Risk:** Low (but bypassed by raw SQL)

### Option C: Explicit in every update call
Set `updatedAt: sql`(unixepoch())`` in every `.update()` call.
- **Pros:** No schema changes
- **Cons:** Error-prone; easy to forget; no enforcement
- **Effort:** Ongoing
- **Risk:** Medium (human error)

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/schema.ts`, migration SQL
- **Affected tables:** All 6 (projects, tags, taggings, notes, goals, project_goals)

## Acceptance Criteria

- [ ] Updating a row changes `updated_at` to current time
- [ ] Strategy is documented and consistent across all tables
- [ ] Works for the scanner's upsert pattern (Slice 2)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
