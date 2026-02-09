# TypeScript Port: High-Level Plan

## Overview

Full rewrite of the Project Dashboard from Rails 8.2 to a TypeScript stack with Bun, Hono, React, and SQLite (via Turso/libSQL). The current app is ~3,500 lines across 151 files with a fully functional web UI, CLI scanning tools, and 6 database tables.

## Target Tech Stack

| Layer | Tool | Replaces |
|-------|------|----------|
| Runtime | **Bun** | Ruby 3.4 |
| API Server | **Hono** | Rails controllers |
| Database | **SQLite via Turso / libSQL** | SQLite via `sqlite3` gem |
| ORM | **Drizzle** | ActiveRecord |
| Validation | **Zod** | AR validations |
| Frontend | **React + Vite** | ERB + Turbo + Stimulus |
| Styling | **Tailwind 4** (same) | Tailwind 4 (same) |
| Data Fetching | **TanStack Query** | Turbo Frames / Streams |
| Routing (client) | **TanStack Router** or **React Router** | Server-rendered pages |
| Git Operations | **simple-git** or Bun `child_process` | Backtick shell commands |
| File Traversal | **fast-glob** + Node `fs` | `Find.find` + `Dir.glob` |
| CLI | **commander** | Rake tasks |
| Testing | **Vitest + Testing Library** | (none exist) |
| Linting / Formatting | **Ultracite + Biome** | RuboCop |

## Current Codebase Inventory

### What Exists

| Component | Size | Files |
|-----------|------|-------|
| ActiveRecord models | 230 lines | 6 models + ApplicationRecord |
| Scanning engine (lib/) | 660 lines | ProjectScanner, ProjectData |
| Controllers + concern | 313 lines | 4 controllers + Filterable |
| ERB templates | 1,124 lines | 30 templates |
| Stimulus JS | 220 lines | 7 controllers |
| Rake tasks | 58 lines | 1 file, 2 tasks |
| Helper methods | 149 lines | ProjectsHelper |
| Standalone indexer | 324 lines | bin/index_all_projects |
| Migrations | 7 files | 6 tables |
| **Total** | **~3,500 lines** | **151 files** |

### Database Schema (6 tables)

- **projects** - path (unique), name, last_commit_date (string), last_commit_message, metadata (JSON), is_fork, pinned, last_viewed_at
- **tags** - name (unique)
- **taggings** - project_id, tag_id (unique pair)
- **notes** - project_id, content
- **goals** - name (unique), description
- **project_goals** - project_id, goal_id (unique pair), status (enum: not_started/in_progress/completed)

### Key Complexity Points

1. **10 ActiveRecord scopes** on Project using SQLite `json_extract()`, `date()`, `substr()`, and `CAST()` for filtering/searching the JSON metadata column
2. **Filterable concern** that chains scopes together with session-persisted filter state
3. **10 Turbo Stream templates** for inline CRUD (notes, tags, goals) - paradigm shift to React state
4. **5 git CLI commands** executed via shell backticks in ProjectData
5. **Recursive directory traversal** with pruning rules in ProjectScanner

## Proposed Project Structure

```
your-project-dashboard/
├── src/
│   ├── server/
│   │   ├── index.ts              # Hono app entry point
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema (6 tables)
│   │   │   ├── client.ts         # libSQL/Turso connection
│   │   │   └── migrations/
│   │   ├── routes/
│   │   │   ├── projects.ts       # CRUD + filtering + pagination
│   │   │   ├── tags.ts           # Tag management
│   │   │   ├── notes.ts          # Note management
│   │   │   └── goals.ts          # Goal management
│   │   ├── services/
│   │   │   ├── scanner.ts        # Port of ProjectScanner
│   │   │   └── project-data.ts   # Port of ProjectData
│   │   └── lib/
│   │       ├── filters.ts        # Port of Filterable concern (query builders)
│   │       └── git.ts            # Git command helpers
│   ├── client/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── ProjectsPage.tsx
│   │   │   └── ProjectDetailPage.tsx
│   │   ├── components/
│   │   │   ├── layout/           # AppLayout, Sidebar, MobileHeader
│   │   │   ├── projects/         # Table, cards, filters, badges
│   │   │   └── shared/           # StatusBadge, Toast, EmptyState
│   │   ├── hooks/                # useProjects, useFilters, useScan
│   │   └── lib/
│   │       ├── api.ts            # API client
│   │       └── types.ts          # Shared types
│   └── shared/
│       └── types.ts              # Types shared between server + client
├── cli/
│   ├── index.ts                  # CLI entry point (commander)
│   └── commands/
│       ├── scan.ts               # projects:scan equivalent
│       └── config.ts             # projects:config equivalent
├── biome.jsonc                   # Ultracite + Biome config
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

## API Endpoints (Hono)

```
GET    /api/projects              # List with filters, pagination, sorting
GET    /api/projects/:id          # Detail with tags, notes, goals
POST   /api/projects/:id/pin      # Toggle pin
POST   /api/projects/:id/view     # Track last viewed

POST   /api/projects/:id/tags     # Add tag
DELETE /api/projects/:id/tags/:id  # Remove tag

POST   /api/projects/:id/notes    # Add note
DELETE /api/projects/:id/notes/:id # Delete note

POST   /api/projects/:id/goals    # Add goal
PATCH  /api/projects/:id/goals/:id # Update goal status
DELETE /api/projects/:id/goals/:id # Delete goal

GET    /api/filters               # Available tech stacks, types for dropdowns
GET    /api/stats                  # Sidebar counts (active, stalled, etc.)
POST   /api/scan                  # Trigger project scan
```

## React Components (~28)

### Layout (3)
- `AppLayout` - sidebar + main content wrapper
- `Sidebar` - nav, pinned projects, recently viewed, smart groups
- `MobileHeader` - hamburger menu + mobile sidebar

### Projects Index (8)
- `ProjectsPage` - page container
- `QuickResumeSection` - 3-col grid of recent project cards
- `QuickResumeCard` - individual card
- `FilterBar` - search + dropdown filters
- `ActiveFilterPills` - removable filter tags
- `ProjectsTable` - sortable table with clickable rows
- `ProjectRow` - table row
- `Pagination` - page navigation

### Project Detail (10)
- `ProjectDetailPage` - page container with grid layout
- `ProjectSidebar` - quick actions + details panel
- `QuickActions` - open editor/terminal/github/copy buttons
- `ProjectDetails` - path, type, commit count
- `TagManager` - tag list + add form
- `NoteManager` - notes list + add form
- `GoalManager` - goals list + add form + status dropdown
- `TechStackBadges` - tech stack display
- `ActivityTimeline` - commit history
- `DocumentationAccordion` - collapsible reference files

### Shared (7)
- `StatusBadge`, `ProjectTypeBadge`, `GoalBadge`, `TechIcon`
- `Toast`, `EmptyState`, `SearchInput`

## Key Migration Decisions

### JSON Metadata Column

The `metadata` JSON column stores ~15 fields and is queried 6+ ways with `json_extract()`. Two options:

1. **Keep as JSON** - Use Drizzle's `sql` template literals for `json_extract()` queries. Turso/libSQL supports the same SQLite JSON functions. Least effort, preserves current flexibility.
2. **Normalize into columns** - Extract frequently-queried fields (tech_stack, inferred_type, description, deployment_status, commit_count) into proper columns. Better type safety and indexing, but requires a schema redesign.

Recommendation: **Keep as JSON initially**, normalize later if query performance becomes an issue.

### Turbo Streams to React

The 10 Turbo Stream templates (inline CRUD for notes, tags, goals) become:
- TanStack Query mutations with `useMutation`
- Optimistic updates via `onMutate` callbacks
- Cache invalidation via `queryClient.invalidateQueries`

### Filter State

Rails version persists filters in the server session. React version should use **URL search params** (`useSearchParams`) so filters are shareable and bookmarkable.

### Scanning Engine

Port ProjectScanner + ProjectData nearly 1:1. Key changes:
- `simple-git` library instead of shell backtick commands (eliminates injection risk)
- `fast-glob` instead of `Find.find` / `Dir.glob`
- `Bun.file()` / `node:fs` instead of `File.readlines`
- Fix the hardcoded cutoff date bug (line 51 of project_data.rb)
- Fix missing `is_fork` attribute (referenced but never defined)
- Consolidate `bin/index_all_projects` (duplicate scanning logic) into the main scanner

## Linting & Formatting Setup

Using **Ultracite with Biome** as the linting/formatting provider:

```bash
bunx ultracite init --linter biome --pm bun --frameworks react --agents claude
```

This sets up:
- `biome.jsonc` extending `ultracite/biome/core` and `ultracite/biome/react`
- Zero-config defaults: 2-space indent, 80-char lines, semicolons, double quotes, trailing commas
- TypeScript strictness, no `any` types, unused variable detection
- Accessibility checks (ARIA, semantic HTML)
- Auto-fix for unused imports, block statements, Tailwind class sorting
- Pre-commit hooks via integration option (Husky or Lefthook)

## Known Risks & Gotchas

1. **SQLite JSON queries** - The 10 Project scopes use `json_extract()`, `CAST()`, `date(substr())`. These work in libSQL but need careful porting to Drizzle's `sql` template syntax.
2. **Ruby regex != JS regex** - Ruby's `m` flag (dotall) = JS's `s` flag. Several patterns in description extraction need adjustment. Ruby's `\A`/`\z` anchors have no direct JS equivalent.
3. **Date handling** - Ruby `Date.parse` is very flexible; JS `new Date()` is not. Use `date-fns` `parseISO` for git date formats.
4. **Shell pipe in git command** - `git log --format='%an' | sort -u` relies on shell piping. Use `Array.from(new Set(...))` in TS instead.
5. **`default_scope` on Note** - No Drizzle equivalent. Must explicitly order by `created_at desc` in every note query or wrap in a helper.
6. **ActiveRecord `find_or_initialize_by`** - No direct Drizzle equivalent. Implement as select-then-insert-or-update.

## Effort Estimate

| Area | Effort |
|------|--------|
| Project scaffolding + tooling (Bun, Vite, Drizzle, Hono, Ultracite) | 1 day |
| DB schema + Drizzle models + Zod validation | 2-3 days |
| Scanning engine port (ProjectScanner + ProjectData) | 2-3 days |
| Hono API endpoints + filter query builders | 2-3 days |
| React components (~28) + Tailwind styling | 5-7 days |
| CLI commands (scan, config) | 1 day |
| Test suite (Vitest + Testing Library) | 2-4 days |
| CI/CD + deployment config | 1 day |
| **Total** | **~16-23 days** |
