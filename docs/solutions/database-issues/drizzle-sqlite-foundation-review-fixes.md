---
title: "Drizzle + SQLite Foundation Schema: Review Fix Patterns"
date: 2026-02-09
category: database-issues
tags:
  - database
  - schema
  - code-review
  - SQLite
  - Drizzle
  - libSQL
  - Zod
  - type-safety
  - triggers
module: src/server/db
symptoms:
  - libSQL batch() fails with "cannot change into wal mode from within a transaction"
  - updatedAt frozen at insert time after UPDATE
  - TypeScript allows arbitrary key access on typed metadata column
  - drizzle-kit push creates tables but triggers are missing
  - Foreign key cascade deletes silently not enforced
---

# Drizzle + SQLite Foundation Schema: Review Fix Patterns

Two rounds of code review on a foundation database slice (Bun + Hono + Drizzle + libSQL/SQLite + Zod) produced 21 findings across security, performance, type safety, and data integrity. This document captures the key patterns and gotchas discovered.

## Related Documents

- [Foundation plan](../../plans/2026-02-08-feat-foundation-scaffolding-and-db-schema-plan.md)
- [Round 1 review fixes](foundation-schema-review-fixes.md)
- [Stack simplification brainstorm](../../brainstorms/2026-02-08-simplify-frontend-stack-brainstorm.md)
- [TypeScript port plan](../../typescript-port-plan.md)

---

## Problem 1: libSQL batch() Cannot Execute PRAGMAs

### Symptom

```
LibsqlBatchError: SQLITE_ERROR: cannot change into wal mode from within a transaction
```

### Root Cause

libSQL's `batch()` wraps all statements in a transaction. SQLite forbids PRAGMAs that change connection state (`journal_mode`, `synchronous`, `foreign_keys`) inside transactions.

### What Didn't Work

```typescript
// BROKEN: batch() wraps in transaction
await client.batch([
  "PRAGMA journal_mode = WAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA cache_size = -8000",
]);
```

### Working Solution

```typescript
// Sequential execution — each PRAGMA runs outside a transaction
await client.execute("PRAGMA journal_mode = WAL");
await client.execute("PRAGMA foreign_keys = ON");
await client.execute("PRAGMA synchronous = NORMAL");
await client.execute("PRAGMA cache_size = -8000");
```

### Key Insight

PRAGMAs are connection-level configuration, not data operations. They must run outside transactions. For local SQLite the latency of 4 sequential calls is negligible (sub-millisecond each).

---

## Problem 2: updatedAt Triggers Cause Double-Write and Recursion Risk

### Symptom

Every UPDATE executes two writes. Under `PRAGMA recursive_triggers = ON`, triggers infinitely recurse until SQLite's depth limit (1000) aborts the transaction.

### Root Cause

An `AFTER UPDATE` trigger that UPDATEs the same row re-fires itself. Without a guard, the inner UPDATE triggers another execution.

### What Didn't Work

```sql
-- BROKEN: fires twice (or infinitely with recursive_triggers = ON)
CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON `projects`
BEGIN UPDATE `projects` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;
```

### Working Solution

```sql
-- SAFE: WHEN guard prevents re-firing
CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON `projects`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `projects` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;
```

### Key Insight

The `WHEN` clause checks if `updated_at` was already changed by the original UPDATE. If it was (application explicitly set it), the trigger skips. When the trigger fires and changes `updated_at`, any recursive attempt sees `NEW != OLD` and stops. This is safe under both `recursive_triggers = OFF` (default) and `recursive_triggers = ON`.

---

## Problem 3: Zod .passthrough() Leaks Index Signature into Types

### Symptom

`ProjectMetadata` type allows arbitrary key access without compile errors, defeating the purpose of removing the explicit `[key: string]: unknown` index signature.

### Root Cause

`z.infer` of a `.passthrough()` schema produces `{ ...knownFields } & { [k: string]: unknown }`. This index signature propagates through `$type<ProjectMetadata>()` on the Drizzle column.

### Current Approach

```typescript
// validators.ts — .passthrough() for runtime extensibility
export const projectMetadataSchema = z.object({ /* fields */ }).passthrough();
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

// schema.ts — type-only import avoids circular runtime dep
import type { ProjectMetadata } from "./validators.ts";
metadata: text("metadata", { mode: "json" }).$type<ProjectMetadata>(),
```

### Better Approach (Identified, Deferred)

Define `ProjectMetadata` as an explicit interface without the index signature. Keep the Zod schema with `.passthrough()` for runtime validation only. Use a compile-time assertion to catch drift:

```typescript
// Strict type for compile-time access
export interface ProjectMetadata {
  lastCommitAuthor: string;
  techStack: string[];
  // ... all known fields, NO index signature
}

// Runtime schema allows extra keys
export const projectMetadataSchema = z.object({ /* fields */ }).passthrough();
```

---

## Problem 4: drizzle-kit push Ignores Custom SQL

### Symptom

After `drizzle-kit push`, the database has all tables and indexes but no triggers. `updatedAt` silently stays frozen at insert time.

### Root Cause

`drizzle-kit push` syncs Drizzle-managed schema (tables, columns, indexes) directly. It does not execute raw SQL from migration files, so triggers, CHECK constraints, and other custom SQL are skipped.

### Workaround

Apply triggers separately after `db:push`:

```bash
# Option A: Manual SQL execution
sqlite3 local.db < drizzle/triggers.sql

# Option B: Add a db:setup script
bun run db:push && bun run db:triggers

# Option C: Use programmatic migrate() instead of push
```

---

## Pattern: Shared Timestamp Columns

Extracted identical `createdAt`/`updatedAt` definitions into a reusable const:

```typescript
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
} as const;

// Spread into each table
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // ... other columns
  ...timestamps,
});
```

`as const` preserves literal types for the spread. Changes to timestamp configuration propagate to all 6 tables automatically.

---

## Pattern: Composite Index Left-Prefix Optimization

SQLite can use the leftmost columns of a composite index for single-column lookups. These single-column indexes were redundant:

```typescript
// REDUNDANT: covered by composite unique index on (projectId, tagId)
index("index_taggings_on_project_id").on(table.projectId)

// REDUNDANT: covered by composite index on (projectId, createdAt)
index("index_notes_on_project_id").on(table.projectId)
```

Removing them reduces write amplification on every INSERT/UPDATE/DELETE with no read penalty.

---

## Prevention Checklist: Drizzle + SQLite Projects

- [ ] Execute PRAGMAs sequentially via `execute()`, never in `batch()`
- [ ] Set `PRAGMA foreign_keys = ON` on every connection (off by default in SQLite)
- [ ] Add `WHEN NEW.col = OLD.col` guard on all self-modifying UPDATE triggers
- [ ] Never set `PRAGMA recursive_triggers = ON` if using updatedAt triggers
- [ ] Verify custom SQL (triggers, CHECKs) is applied — `db:push` skips them
- [ ] Test cascade deletes in dev to confirm foreign_keys pragma is active
- [ ] Review composite indexes before adding single-column indexes on leftmost columns
- [ ] Use `import type` for cross-file type imports to avoid circular runtime deps
- [ ] If using `.passthrough()`, define the TypeScript type explicitly (not via `z.infer`)
- [ ] Bind local dev servers to `127.0.0.1`, not `0.0.0.0`

## Common Gotchas Quick Reference

| Gotcha | Why It Happens | Fix |
|--------|---------------|-----|
| PRAGMAs fail in batch() | batch() wraps in transaction | Use sequential execute() |
| updatedAt frozen after UPDATE | SQLite has no ON UPDATE CURRENT_TIMESTAMP | AFTER UPDATE triggers with WHEN guard |
| Triggers double-write | AFTER UPDATE re-fires on own UPDATE | `WHEN NEW.col = OLD.col` |
| .passthrough() breaks types | z.infer includes index signature | Define type explicitly |
| db:push misses triggers | push only syncs Drizzle schema | Apply custom SQL separately |
| Cascade deletes don't work | foreign_keys OFF by default | Set PRAGMA on every connection |
| Redundant indexes | Left-prefix of composite covers it | Remove single-column index |
