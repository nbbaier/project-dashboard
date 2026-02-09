---
status: completed
priority: p1
issue_id: "001"
tags: [code-review, data-integrity, schema]
dependencies: []
---

# Add WHEN guard to updatedAt triggers to prevent double-write and recursion risk

## Problem Statement

All 6 `AFTER UPDATE` triggers fire an `UPDATE` on the same row, causing every update to execute two writes. If `PRAGMA recursive_triggers = ON` is ever set, these triggers will infinitely recurse until SQLite hits its depth limit (1000) and aborts the transaction.

## Findings

- **Source:** data-integrity-guardian (HIGH), performance-oracle, architecture-strategist (3 agents)
- **Severity:** P1 (double-write on every update; latent infinite recursion)
- **File:** `drizzle/0000_abandoned_mastermind.sql` lines 71-82
- **Evidence:** Each trigger does `AFTER UPDATE ON table BEGIN UPDATE table SET updated_at = unixepoch() WHERE id = NEW.id; END` — the inner UPDATE re-fires the trigger when recursive_triggers is ON.

## Proposed Solutions

### Option A: Add WHEN guard (Recommended)
```sql
CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON `projects`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `projects` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;
```
The WHEN clause prevents re-firing: when the trigger sets `updated_at`, the recursive attempt sees `NEW.updated_at != OLD.updated_at` and stops.
- **Pros:** Simple, no column enumeration, safe under recursive_triggers = ON
- **Cons:** Explicitly setting updated_at to same value still triggers
- **Effort:** Small (update 6 triggers in migration SQL)
- **Risk:** None

### Option B: Use AFTER UPDATE OF (column exclusion)
List every column except `updated_at` in the `OF` clause so the trigger only fires on non-timestamp changes.
- **Pros:** Most precise; zero unnecessary trigger firings
- **Cons:** Must update column list when adding new columns to tables
- **Effort:** Medium
- **Risk:** Low (maintenance burden)

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `drizzle/0000_abandoned_mastermind.sql`
- **Affected tables:** All 6 (projects, tags, taggings, notes, goals, project_goals)

## Acceptance Criteria

- [x] All 6 triggers include WHEN guard preventing re-fire
- [x] Update to a row causes exactly one write (not two)
- [x] Safe under `PRAGMA recursive_triggers = ON`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | SQLite AFTER UPDATE triggers re-fire on their own UPDATE without a guard |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
