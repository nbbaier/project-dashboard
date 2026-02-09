---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, data-integrity, schema]
dependencies: []
---

# Add CHECK constraint on projectGoals.status column

## Problem Statement

Drizzle's `text({ enum })` is compile-time only. The generated SQL has no CHECK constraint, so direct SQL operations can insert arbitrary strings into the `status` column.

## Findings

- **Source:** security-sentinel (Low), data-integrity-guardian (Medium)
- **File:** `drizzle/0000_abandoned_mastermind.sql:24`

## Proposed Solutions

Add `CHECK (status IN ('not_started', 'in_progress', 'completed'))` to the migration SQL alongside the trigger definitions.

## Acceptance Criteria

- [ ] Database rejects invalid status values via CHECK constraint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review (round 2) | Drizzle enum option is TypeScript-only, no SQL enforcement |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
