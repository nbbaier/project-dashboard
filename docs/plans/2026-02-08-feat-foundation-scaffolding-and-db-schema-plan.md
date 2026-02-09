---
title: "Foundation: Project Scaffolding + DB Schema"
type: feat
date: 2026-02-08
slice: 1 of 5
---

# Foundation: Project Scaffolding + DB Schema

## Overview

Set up the TypeScript toolchain and define the database layer for Project Dashboard. This is **Slice 1** of the vertical-slice port strategy — it produces no runtime behavior beyond a health check, but validates that the server toolchain is wired up and the schema is ready for the scanning engine (Slice 2).

## Motivation

Everything else in the port depends on this foundation being right. The Drizzle schema must faithfully reproduce the 6-table Rails schema (including the JSON metadata column and its `json_extract()` query patterns), and the tooling must be configured so subsequent slices can focus on business logic rather than build issues.

## Proposed Solution

Initialize a Bun project, configure server-side tooling (Hono, Drizzle, Biome), define Drizzle schemas for all 6 tables, create a focused Zod validation schema for the metadata JSON structure, and verify the stack with a minimal Hono health endpoint that confirms DB connectivity.

Frontend dependencies (React, Vite, TanStack Query, Tailwind) are **intentionally deferred** to the slice that introduces the UI.

## Technical Considerations

### Drizzle + libSQL for SQLite

- Use `@libsql/client` for the database connection (local SQLite file for dev, Turso URL for prod)
- Drizzle's `sqliteTable` with `text`, `integer` column types
- The `metadata` column is `text` mode storing JSON — use `text("metadata").$type<ProjectMetadata>()` for type-level annotation, with manual `JSON.parse`/`JSON.stringify` in a thin data access helper
- `last_commit_date` is stored as a string (ISO 8601 with time), not a SQLite date — matches the Rails schema

### JSON Metadata Column

Keep as JSON per the port plan recommendation. The column stores ~15 fields and is queried 6+ ways via `json_extract()`. Normalizing now would be premature — validate the json_extract approach works in Drizzle first.

### Validation Boundary

Zod validates at **system boundaries** (scanner output, API request bodies). Drizzle types ensure compile-time correctness for DB operations. Zod output types must satisfy Drizzle insert types.

For this slice, only `insertProjectSchema` and `projectMetadataSchema` are needed — the scanner (Slice 2) is the first writer. Remaining insert schemas (`insertTagSchema`, `insertNoteSchema`, etc.) belong in Slice 3 when API routes become the second writer.

### Tooling

- **Ultracite + Biome** for linting/formatting: `bunx ultracite init --linter biome --pm bun --agents claude`
- **Drizzle Kit** for migration generation and push
- **TypeScript** strict mode, no `any`

## Acceptance Criteria

### Project Scaffolding
- [x] `bun init` with correct `package.json` (name, type: module)
- [x] All dependencies installed (see dependency list below)
- [x] `tsconfig.json` with strict mode
- [x] `biome.jsonc` configured via Ultracite
- [x] `drizzle.config.ts` pointing to schema and local SQLite file
- [x] Scripts in `package.json`: `dev` (runs Hono), `db:generate`, `db:push`, `lint`

### Database Schema (`src/server/db/schema.ts`)

All columns must explicitly specify `NOT NULL` where the Rails schema does. Reference mapping:

#### `projects` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| path | text | NOT NULL, unique |
| name | text | NOT NULL |
| lastCommitDate | text | NOT NULL |
| lastCommitMessage | text | nullable |
| metadata | text | nullable, `.$type<ProjectMetadata>()` |
| isFork | integer (boolean) | NOT NULL, default 0 |
| pinned | integer (boolean) | NOT NULL, default 0 |
| lastViewedAt | integer (timestamp) | nullable |
| createdAt | integer (timestamp) | NOT NULL |
| updatedAt | integer (timestamp) | NOT NULL |

**Indexes** (4 separate single-column indexes, matching Rails):
- `index_projects_on_is_fork` → `isFork`
- `index_projects_on_last_commit_date` → `lastCommitDate`
- `index_projects_on_last_viewed_at` → `lastViewedAt`
- `index_projects_on_pinned` → `pinned`

#### `tags` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| name | text | NOT NULL, unique |
| createdAt | integer | NOT NULL |
| updatedAt | integer | NOT NULL |

#### `taggings` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| projectId | integer | NOT NULL, FK → projects (cascade delete) |
| tagId | integer | NOT NULL, FK → tags (cascade delete) |
| createdAt | integer | NOT NULL |
| updatedAt | integer | NOT NULL |

**Indexes:**
- Unique composite: `(projectId, tagId)`
- Single-column: `projectId`
- Single-column: `tagId`

#### `notes` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| projectId | integer | NOT NULL, FK → projects (cascade delete) |
| content | text | NOT NULL |
| createdAt | integer | NOT NULL |
| updatedAt | integer | NOT NULL |

**Indexes:**
- Composite: `(projectId, createdAt)`
- Single-column: `projectId`

#### `goals` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| name | text | NOT NULL, unique |
| description | text | nullable |
| createdAt | integer | NOT NULL |
| updatedAt | integer | NOT NULL |

#### `projectGoals` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| projectId | integer | NOT NULL, FK → projects (cascade delete) |
| goalId | integer | NOT NULL, FK → goals (cascade delete) |
| status | text | NOT NULL, default "not_started" |
| createdAt | integer | NOT NULL |
| updatedAt | integer | NOT NULL |

**Indexes:**
- Unique composite: `(projectId, goalId)`
- Single-column: `projectId`
- Single-column: `goalId`

#### Shared Constants

```typescript
export const PROJECT_GOAL_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type ProjectGoalStatus = (typeof PROJECT_GOAL_STATUSES)[number];
```

### Database Client (`src/server/db/client.ts`)
- [x] libSQL client configured for local SQLite file (`file:local.db`) with env var override for Turso URL
- [x] Drizzle instance exported and ready for queries

### Zod Validation (`src/server/db/validators.ts`)
- [x] `insertProjectSchema` — validates path (required), name (required), lastCommitDate (required)
- [x] `projectGoalStatusEnum` — Zod enum derived from `PROJECT_GOAL_STATUSES`
- [x] `projectMetadataSchema` — Zod schema for the metadata JSON structure with known fields:
  - `lastCommitAuthor: z.string()`
  - `recentCommits: z.array(z.object({ date: z.string(), message: z.string() }))`
  - `commitCount8m: z.number()`
  - `contributors: z.array(z.string())`
  - `gitRemote: z.string().optional()`
  - `referenceFiles: z.object({ root, ai, cursor, tasks, docs — all z.array(z.string()).optional() })`
  - `description: z.string().optional()`
  - `currentState: z.string().optional()`
  - `techStack: z.array(z.string())`
  - `inferredType: z.string()`
  - `deploymentStatus: z.string().optional()`
  - `nestedRepos: z.array(z.string()).optional()`
  - `plansCount: z.number().optional()`
  - `aiDocsCount: z.number().optional()`
  - `claudeDescription: z.string().nullable().optional()`
  - `errors: z.array(z.string()).optional()`
  - `.passthrough()` to allow new fields from the scanner without breaking validation

### Minimal Verification
- [x] `src/server/index.ts` — Hono app with `GET /api/health` that queries the DB (`SELECT 1`) and returns `{ status: "ok" }`
- [x] `bun run dev` starts Hono on port 3001
- [x] `bun run db:push` creates all 6 tables in local SQLite
- [x] `bun run lint` passes with zero errors

### Migration
- [x] `drizzle/` directory with generated migration SQL
- [x] Migration creates all 6 tables with correct columns, types, constraints, and indexes
- [x] `local.db` added to `.gitignore`

## Dependencies

### Production
```
hono
@libsql/client
drizzle-orm
zod
```

### Development
```
typescript
drizzle-kit
ultracite
```

### Deferred to Later Slices
```
react, react-dom            # Slice 3 (UI)
@tanstack/react-query       # Slice 3 (UI)
vite, @vitejs/plugin-react  # Slice 3 (UI)
tailwindcss                 # Slice 3 (UI)
@types/react, @types/react-dom  # Slice 3 (UI)
vitest, @testing-library/react  # First test-writing slice
commander                   # Slice 2 (CLI scan command)
simple-git, fast-glob       # Slice 2 (scanner)
```

## File Inventory

```
src/
└── server/
    ├── index.ts              # Hono app + health endpoint (exports default for Bun.serve)
    └── db/
        ├── schema.ts         # Drizzle schema (6 tables) + PROJECT_GOAL_STATUSES constant
        ├── client.ts         # libSQL connection + Drizzle instance
        └── validators.ts     # Zod schemas (insertProject, metadata, status enum)

Configuration:
├── package.json
├── tsconfig.json
├── biome.jsonc               # Generated by Ultracite
├── drizzle.config.ts
├── .gitignore
└── drizzle/                  # Generated migrations
```

## Success Metrics

- `bun run db:push` creates all 6 tables matching the Rails schema
- `bun run dev` starts Hono without errors
- `bun run lint` passes clean
- Health endpoint returns `{ status: "ok" }` confirming DB connectivity

## Dependencies & Risks

- **Drizzle + libSQL compatibility** — Drizzle has first-class libSQL support via `drizzle-orm/libsql`, well-tested
- **Ultracite init** — May need manual adjustments if generated config doesn't match desired strictness
- **Hono on Bun** — Use `export default app` pattern for Bun's native serve; no `@hono/node-server` adapter needed

## References

### Internal
- Port plan: `docs/typescript-port-plan.md`
- Rails schema: `~/Code/your-project-dashboard/db/schema.rb`
- Rails models: `~/Code/your-project-dashboard/app/models/*.rb`

### External
- [Drizzle SQLite docs](https://orm.drizzle.team/docs/get-started/sqlite-new)
- [libSQL client](https://github.com/tursodatabase/libsql-client-ts)
- [Ultracite](https://github.com/haydenbleasel/ultracite)
- [Hono on Bun](https://hono.dev/docs/getting-started/bun)
