---
title: Foundation Schema Review Fixes
date: 2026-02-08
category: database-issues
tags:
   [
      sqlite-pragmas,
      foreign-keys,
      type-safety,
      drizzle-orm,
      error-handling,
      health-check,
   ]
module: src/server/db, src/server/index.ts
severity: P1/P2
symptoms:
   - Foreign key cascade deletes silently ignored by SQLite
   - Type safety undermined by index signature on metadata interface
   - Stack traces leaked in health endpoint on DB errors
   - Missing compile-time type narrowing for project goal status
   - Relational queries fail without relations declarations
root_cause: SQLite requires explicit PRAGMA foreign_keys=ON; index signature defeats interface constraints; missing enum narrowing, error boundaries, and relational declarations
status: resolved
---

# Foundation Schema Review Fixes

Code review of Slice 1 (Foundation) identified 5 issues in the database layer and server entry. Two were P1 critical (data integrity), three were P2 important (type safety, error handling, ORM setup).

## Solution

### Fix 1: SQLite PRAGMAs (P1 - Critical)

**File:** `src/server/db/client.ts`

**Problem:** SQLite ignores foreign key constraints by default. Cascade deletes defined in Drizzle schema (`onDelete: "cascade"`) were silently broken — deleting a project would leave orphaned taggings, notes, and project_goals rows.

**Fix:**

```typescript
await client.execute("PRAGMA foreign_keys = ON");
await client.execute("PRAGMA journal_mode = WAL");
await client.execute("PRAGMA synchronous = NORMAL");
await client.execute("PRAGMA cache_size = -64000");
```

Added after `createClient()`, before `drizzle()`. WAL improves concurrency, `synchronous = NORMAL` balances durability/performance, `cache_size = -64000` allocates 64MB cache.

### Fix 2: Remove Unsafe Index Signature (P1 - Critical)

**File:** `src/server/db/schema.ts`

**Problem:** `ProjectMetadata` interface had `[key: string]: unknown` which made every typed property assignable to `unknown`, defeating TypeScript's type checking entirely.

**Before:**

```typescript
export interface ProjectMetadata {
   lastCommitAuthor: string;
   // ... other typed fields
   [key: string]: unknown; // defeats all type safety
}
```

**After:**

```typescript
export interface ProjectMetadata {
   lastCommitAuthor: string;
   // ... other typed fields
   // No index signature — Zod .passthrough() handles runtime extensibility
}
```

### Fix 3: Health Endpoint Error Handling (P2)

**File:** `src/server/index.ts`

**Problem:** Unhandled DB errors would leak stack traces to clients.

**Fix:**

```typescript
app.get("/api/health", async (c) => {
   try {
      await db.run(sql`SELECT 1`);
      return c.json({ status: "ok" });
   } catch {
      return c.json({ status: "error" }, 503);
   }
});
```

### Fix 4: Enum Type on Goal Status (P2)

**File:** `src/server/db/schema.ts`

**Problem:** `text("status")` gives `string` type, losing the union type information.

**Fix:**

```typescript
status: text("status", { enum: PROJECT_GOAL_STATUSES })
  .notNull()
  .default("not_started"),
// Type is now "not_started" | "in_progress" | "completed" instead of string
```

### Fix 5: Drizzle Relations Declarations (P2)

**File:** `src/server/db/schema.ts`

**Problem:** Without `relations()`, Drizzle's relational query API (`db.query.*.findMany({ with: ... })`) doesn't work.

**Fix:** Added relations for all 6 tables:

```typescript
export const projectsRelations = relations(projects, ({ many }) => ({
   taggings: many(taggings),
   notes: many(notes),
   projectGoals: many(projectGoals),
}));

export const taggingsRelations = relations(taggings, ({ one }) => ({
   project: one(projects, {
      fields: [taggings.projectId],
      references: [projects.id],
   }),
   tag: one(tags, {
      fields: [taggings.tagId],
      references: [tags.id],
   }),
}));
// ... (plus tagsRelations, notesRelations, goalsRelations, projectGoalsRelations)
```

Enables queries like:

```typescript
const projects = await db.query.projects.findMany({
   with: { taggings: { with: { tag: true } }, notes: true },
});
```

### Deferred: updatedAt Auto-Update (#6)

SQLite has no `ON UPDATE CURRENT_TIMESTAMP`. Options: Drizzle hook, SQLite trigger, or explicit in every update call. Deferred to Slice 2 when update operations are implemented.

## Prevention

### SQLite PRAGMAs

- Always set `PRAGMA foreign_keys = ON` when using SQLite with any ORM that defines cascade deletes
- Add a test that verifies cascade deletes actually work (insert parent + child, delete parent, assert child gone)
- Document each PRAGMA with inline comments explaining why it exists

### TypeScript Index Signatures

- Never use `[key: string]: unknown` on interfaces with explicit properties — it undermines all type checking
- Use Zod `.passthrough()` for runtime extensibility, TypeScript interfaces for compile-time safety
- Rule: "Extensibility via Zod, not via TypeScript index signatures"

### API Error Handling

- All route handlers must have try/catch or app-level error middleware
- Never expose stack traces in API responses — log server-side, return generic client messages
- Test endpoints with mocked DB failures to verify error responses

### Drizzle Enum Columns

- Every enum column must use `text({ enum: CONSTANT })` for compile-time type narrowing
- Keep the `as const` array above the table definition

### Drizzle Relations

- Every table with foreign keys must have a corresponding `relations()` declaration
- Test relational queries (`{ with: ... }`) before merging schema changes
- Add relations immediately when adding foreign keys, not as a separate step

## Related Documentation

- [`docs/plans/2026-02-08-feat-foundation-scaffolding-and-db-schema-plan.md`](../plans/2026-02-08-feat-foundation-scaffolding-and-db-schema-plan.md) — Slice 1 implementation plan
- [`docs/typescript-port-plan.md`](../typescript-port-plan.md) — Overall port architecture
- [Drizzle Relations docs](https://orm.drizzle.team/docs/relations)
- [SQLite PRAGMA reference](https://www.sqlite.org/pragma.html)
