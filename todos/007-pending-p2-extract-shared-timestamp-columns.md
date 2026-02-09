---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, quality, schema]
dependencies: []
---

# Extract shared timestamp columns to reduce 6x duplication

## Problem Statement

The identical `createdAt`/`updatedAt` column definition is repeated across all 6 tables (12 column definitions total). This makes the eventual `updatedAt` auto-update fix require 6 edits instead of 1.

## Findings

- **Source:** pattern-recognition agent
- **Severity:** P2 (duplication + makes todo #003 harder)
- **File:** `src/server/db/schema.ts` — 6 identical blocks

## Proposed Solutions

### Option A: Shared timestamps object (Recommended)
```typescript
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
} as const;
```
Then spread `...timestamps` into each table.
- **Pros:** DRY; updatedAt strategy change becomes 1-line edit
- **Cons:** Slightly less explicit per table
- **Effort:** Small
- **Risk:** None (common Drizzle idiom)

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `src/server/db/schema.ts`

## Acceptance Criteria

- [ ] Timestamp columns defined once, spread into all 6 tables
- [ ] `drizzle-kit generate` reports no schema changes (confirms equivalence)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
