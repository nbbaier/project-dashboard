---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, performance, schema]
dependencies: []
---

# Replace low-cardinality boolean indexes with partial indexes

## Problem Statement

Indexes on `is_fork` and `pinned` (boolean columns) have extremely low cardinality. SQLite's query planner will almost never use them. They add write overhead with no read benefit.

## Findings

- **Source:** performance-oracle agent
- **File:** `src/server/db/schema.ts:69,72`

## Proposed Solutions

### Option A: Remove both, add partial index for pinned
Remove `index_projects_on_is_fork` and `index_projects_on_pinned`. Add a partial index via raw SQL migration: `CREATE INDEX index_projects_pinned ON projects(name) WHERE pinned = 1`.
- **Pros:** Only indexes the small subset of pinned rows; useful for sidebar query
- **Cons:** Partial indexes need raw SQL migration (Drizzle doesn't support natively)
- **Effort:** Small
- **Risk:** Low

### Option B: Just remove both
- **Pros:** Simplest; reduces write overhead
- **Cons:** No index for pinned queries
- **Effort:** Trivial

## Recommended Action

_To be filled during triage._

## Acceptance Criteria

- [ ] Boolean indexes removed or replaced with partial indexes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |
