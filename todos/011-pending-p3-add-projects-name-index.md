---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, performance, schema]
dependencies: []
---

# Add name index on projects table for search queries

## Problem Statement

The Rails app searches by project name. There is no index on `projects.name`, so search queries will full-table scan.

## Findings

- **Source:** performance-oracle agent
- **File:** `src/server/db/schema.ts` indexes block (lines 68-73)

## Proposed Solutions

### Option A: Add B-tree index (Recommended)
Add `index("index_projects_on_name").on(table.name)`.
- **Pros:** Helps prefix search and ORDER BY name
- **Cons:** Won't help infix `LIKE '%term%'` queries
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] `projects.name` has an index

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |
