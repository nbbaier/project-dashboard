---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance, schema]
dependencies: []
---

# Remove redundant single-column indexes covered by composite indexes

## Problem Statement

Three single-column indexes are fully redundant with existing composite unique indexes (SQLite can use the leftmost column of a composite index for single-column lookups):

1. `index_taggings_on_project_id` — redundant with `index_taggings_on_project_id_and_tag_id`
2. `index_project_goals_on_project_id` — redundant with `index_project_goals_on_project_id_and_goal_id`
3. `index_notes_on_project_id` — redundant with `index_notes_on_project_id_and_created_at`

Each redundant index adds write overhead on every INSERT/UPDATE/DELETE.

## Findings

- **Source:** performance-oracle agent
- **Severity:** P2 (reduces write amplification for scanner upserts)
- **Files:** `src/server/db/schema.ts` lines 109, 176, 134

## Proposed Solutions

### Option A: Remove all 3 redundant indexes (Recommended)
Delete the 3 single-column index lines from schema.ts, regenerate migration.
- **Pros:** Less write overhead, smaller DB, cleaner schema
- **Cons:** None — composite indexes fully cover these lookups
- **Effort:** Trivial (delete 3 lines)
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/schema.ts`, `drizzle/` migration

## Acceptance Criteria

- [ ] 3 redundant indexes removed from schema
- [ ] Migration regenerated
- [ ] `db:push` succeeds

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
