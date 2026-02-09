---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, performance]
dependencies: []
---

# Reduce SQLite cache_size from 64MB to 8MB

## Problem Statement

`PRAGMA cache_size = -64000` allocates 64 MB of page cache. For a local dev tool tracking a few hundred repos, the entire DB will be under 1 MB. This wastes 56 MB of resident memory.

## Findings

- **Source:** performance-oracle agent
- **File:** `src/server/db/client.ts:14`

## Proposed Solutions

Change to `PRAGMA cache_size = -8000` (8 MB).

## Acceptance Criteria

- [ ] `cache_size` set to `-8000`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |
