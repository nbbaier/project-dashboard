# TypeScript Port: High-Level Plan

**Last Updated:** 2026-02-08 (revised after stack simplification brainstorm)

## Overview

Full rewrite of the Project Dashboard from Rails 8.2 to a TypeScript stack with Bun, Hono, and server-rendered HTML. The current app is ~3,500 lines across 151 files with a fully functional web UI, CLI scanning tools, and 6 database tables.

**Key architectural decision:** The Rails app is fundamentally server-rendered with minimal client-side interactivity (~220 lines of Stimulus JS). The original port plan called for a React SPA with TanStack Query/Router, but this adds unnecessary complexity. Instead, we'll stay close to the Rails model: server-rendered HTML with htmx for dynamic updates.

See: `docs/brainstorms/2026-02-08-simplify-frontend-stack-brainstorm.md` for full rationale.

## Target Tech Stack

| Layer                | Tool                          | Replaces                           |
| -------------------- | ----------------------------- | ---------------------------------- |
| Runtime              | **Bun**                       | Ruby 3.4                           |
| Server/Router        | **Hono**                      | Rails controllers + routing        |
| Templating           | **Hono JSX**                  | ERB templates                      |
| Database             | **SQLite via Turso / libSQL** | SQLite via `sqlite3` gem           |
| ORM                  | **Drizzle**                   | ActiveRecord                       |
| Validation           | **Zod**                       | AR validations                     |
| Interactivity        | **htmx**                      | Turbo Frames/Streams               |
| Client JS            | **Vanilla JS (~60 lines)**    | 7 Stimulus controllers (220 lines) |
| Styling              | **Tailwind 4** (same)         | Tailwind 4 (same)                  |
| Bundling             | **bun build**                 | Sprockets                          |
| Git Operations       | **simple-git**                | Backtick shell commands            |
| File Traversal       | **fast-glob** + Node `fs`     | `Find.find` + `Dir.glob`           |
| CLI                  | **commander**                 | Rake tasks                         |
| Testing              | **Vitest + Testing Library**  | (none exist)                       |
| Linting / Formatting | **Ultracite + Biome**         | RuboCop                            |

## Current Codebase Inventory

### What Exists

| Component              | Size             | Files                        |
| ---------------------- | ---------------- | ---------------------------- |
| ActiveRecord models    | 230 lines        | 6 models + ApplicationRecord |
| Scanning engine (lib/) | 660 lines        | ProjectScanner, ProjectData  |
| Controllers + concern  | 313 lines        | 4 controllers + Filterable   |
| ERB templates          | 1,124 lines      | 30 templates                 |
| Stimulus JS            | 220 lines        | 7 controllers                |
| Rake tasks             | 58 lines         | 1 file, 2 tasks              |
| Helper methods         | 149 lines        | ProjectsHelper               |
| Standalone indexer     | 324 lines        | bin/index_all_projects       |
| Migrations             | 7 files          | 6 tables                     |
| **Total**              | **~3,500 lines** | **151 files**                |

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
3. **10 Turbo Stream templates** for inline CRUD (notes, tags, goals) - port to htmx HTML fragments
4. **5 git CLI commands** executed via shell backticks in ProjectData
5. **Recursive directory traversal** with pruning rules in ProjectScanner

## Proposed Project Structure

```
project-dashboard/
├── src/
│   ├── server/
│   │   ├── index.ts              # Hono app entry, Bun.serve({ fetch: app.fetch })
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema (6 tables)
│   │   │   ├── client.ts         # libSQL/Turso connection
│   │   │   └── migrations/
│   │   ├── routes/
│   │   │   ├── projects.ts       # HTML routes: index, show, pin/unpin
│   │   │   ├── tags.ts           # htmx fragment routes for tags
│   │   │   ├── notes.ts          # htmx fragment routes for notes
│   │   │   ├── goals.ts          # htmx fragment routes for goals
│   │   │   └── api.ts            # JSON routes for CLI (scan, health)
│   │   ├── views/
│   │   │   ├── layout.tsx        # Base HTML layout (Hono JSX)
│   │   │   ├── projects/
│   │   │   │   ├── index.tsx     # Projects list page
│   │   │   │   ├── show.tsx      # Project detail page
│   │   │   │   └── _partials/    # Reusable fragments
│   │   │   │       ├── table.tsx
│   │   │   │       ├── filter-form.tsx
│   │   │   │       ├── quick-resume-card.tsx
│   │   │   │       └── sidebar.tsx
│   │   │   └── shared/
│   │   │       ├── badges.tsx    # Status, type, tech badges
│   │   │       └── icons.tsx     # SVG icons
│   │   ├── services/
│   │   │   ├── scanner.ts        # Port of ProjectScanner
│   │   │   └── project-data.ts   # Port of ProjectData
│   │   └── lib/
│   │       ├── filters.ts        # Port of Filterable concern (query builders)
│   │       └── git.ts            # Git command helpers (simple-git)
│   └── client/
│       ├── main.ts               # Entry point: accordion, search debounce, etc.
│       └── styles.css            # Tailwind imports
├── public/                       # Built assets land here
│   ├── main.js                   # Bundled client JS
│   └── styles.css                # Processed Tailwind CSS
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
└── bunfig.toml                   # bun-plugin-tailwind config
```

## Routes (Hono)

### HTML Routes (server-rendered pages)

```
GET  /                    → redirect to /projects
GET  /projects            → index page (full HTML)
GET  /projects/:id        → detail page (full HTML)
POST /projects/:id/pin    → toggle pin, redirect back
```

### htmx Fragment Routes (return HTML snippets)

```
POST   /projects/:id/tags          → add tag, return updated tags HTML
DELETE /projects/:id/tags/:tagId   → remove tag, return updated tags HTML

POST   /projects/:id/notes         → add note, return updated notes HTML
DELETE /projects/:id/notes/:noteId → delete note, return updated notes HTML

POST   /projects/:id/goals         → add goal, return updated goals HTML
PATCH  /projects/:id/goals/:goalId → update status, return updated goals HTML
DELETE /projects/:id/goals/:goalId → delete goal, return updated goals HTML
```

### JSON API Routes (for CLI)

```
POST /api/scan    → trigger project scan, return JSON status
GET  /api/health  → health check, return JSON
```

## Server Templates (Hono JSX)

Port the 30 ERB templates to Hono JSX (`.tsx` files that render to HTML strings on the server). The conversion is nearly mechanical:

| Rails ERB                              | Hono JSX                             | Notes                             |
| -------------------------------------- | ------------------------------------ | --------------------------------- |
| `<%= project.name %>`                  | `{project.name}`                     | JS expressions                    |
| `<% if condition %>`                   | `{condition && ...}`                 | Conditional rendering             |
| `<% @projects.each do \|p\| %>`        | `{projects.map(p => ...)}`           | Array iteration                   |
| `<%= link_to "Text", path %>`          | `<a href={path}>Text</a>`            | Standard HTML                     |
| `<%= render "partial" %>`              | `<Partial />`                        | Component composition             |
| `<%= button_to path, method: :post %>` | `<form method="POST" action={path}>` | HTML forms                        |
| Turbo Frame tag                        | htmx attributes                      | `hx-post`, `hx-target`, `hx-swap` |

Tailwind classes copy directly — no changes needed.

## Client-Side Interactivity

### htmx for Dynamic Updates

Replace Turbo Frames with htmx for inline CRUD:

```html
<!-- Adding a tag -->
<form
   hx-post="/projects/123/tags"
   hx-target="#project-tags"
   hx-swap="innerHTML"
>
   <input name="tag_name" />
   <button type="submit">Add Tag</button>
</form>

<div id="project-tags">
   <!-- Server returns updated HTML fragment for this div -->
</div>
```

### Vanilla JS for Micro-Interactions

Port the 7 Stimulus controllers (~220 lines) to vanilla JS (~60 lines):

| Stimulus Controller            | Vanilla JS                          | Lines |
| ------------------------------ | ----------------------------------- | ----- |
| `accordion_controller.js`      | Toggle `.hidden` class on click     | ~10   |
| `clickable_rows_controller.js` | `addEventListener('click')` on rows | ~10   |
| `search_form_controller.js`    | `setTimeout` debounce on input      | ~15   |
| `quick_actions_controller.js`  | Clipboard API, shell commands       | ~20   |
| `note_input_controller.js`     | Auto-resize textarea                | ~5    |
| `tag_input_controller.js`      | Enter key submit                    | ~5    |

htmx handles the remaining controllers (form submissions, DOM updates).

## Key Migration Decisions

### JSON Metadata Column

Keep as JSON. Use Drizzle's `sql` template literals for `json_extract()` queries:

```typescript
// ActiveRecord: Project.where("json_extract(metadata, '$.tech_stack') LIKE ?", "%ruby%")
// Drizzle:
db.select()
   .from(projects)
   .where(
      sql`json_extract(${projects.metadata}, '$.tech_stack') LIKE '%ruby%'`,
   );
```

libSQL supports all SQLite JSON functions. Normalize later if needed.

### Turbo Streams → htmx

Direct mapping:

| Rails Turbo                                | htmx Equivalent                 |
| ------------------------------------------ | ------------------------------- |
| `<%= turbo_frame_tag "project_tags" %>`    | `<div id="project-tags">`       |
| `data: { turbo_frame: "project_tags" }`    | `hx-target="#project-tags"`     |
| Turbo Stream `replace` action              | `hx-swap="innerHTML"`           |
| `render partial, formats: [:turbo_stream]` | Return HTML fragment from route |

### Filter State

Rails persists filters in session. Port to URL query params:

```typescript
// Rails: session[:filters] = { status: 'active', tech: 'ruby' }
// Hono: /projects?status=active&tech=ruby
app.get("/projects", async (c) => {
   const { status, tech, search } = c.req.query();
   // Apply filters to DB query
});
```

Filters remain shareable and bookmarkable. Hono JSX templates read `c.req.query()` to pre-fill filter form.

### Scanning Engine

Port ProjectScanner + ProjectData nearly 1:1:

| Ruby                             | TypeScript                         |
| -------------------------------- | ---------------------------------- |
| `Find.find(base_path)`           | `fast-glob` with `**/.git` pattern |
| `` `git log --format='%an'` ``   | `simpleGit().log()`                |
| `File.readlines().grep(/regex/)` | `Bun.file().text().match(/regex/)` |
| `Date.parse`                     | `date-fns` `parseISO`              |

**Fixes to apply:**

- Remove hardcoded cutoff date (project_data.rb:51)
- Define missing `is_fork` attribute
- Consolidate `bin/index_all_projects` into ProjectScanner

### Static Assets & Bundling

Build client assets with `bun build`:

```json
// package.json scripts
{
   "build:client": "bun build src/client/main.ts --outdir public --target browser",
   "build:css": "bun build src/client/styles.css --outdir public",
   "build": "bun run build:client && bun run build:css"
}
```

`bunfig.toml` for Tailwind processing:

```toml
[build]
plugins = ["bun-plugin-tailwind"]
```

Serve `public/` via Hono's `serveStatic()` middleware. In dev, use `bun build --watch` or re-run on file changes.

htmx can be loaded from CDN (`<script src="https://unpkg.com/htmx.org@2.0.3"></script>`) or bundled.

## Linting & Formatting Setup

Using **Ultracite with Biome**:

```bash
bunx ultracite init --linter biome --pm bun --agents claude
```

Note: **Don't use `--frameworks react`** since we're not using client-side React. Hono JSX is server-only.

This sets up:

- `biome.jsonc` extending `ultracite/biome/core`
- Zero-config defaults: 2-space indent, 80-char lines, semicolons, double quotes, trailing commas
- TypeScript strictness, no `any` types, unused variable detection
- Accessibility checks (ARIA, semantic HTML)
- Auto-fix for unused imports, block statements

## Known Risks & Gotchas

1. **SQLite JSON queries** - The 10 Project scopes use `json_extract()`, `CAST()`, `date(substr())`. These work in libSQL but need careful porting to Drizzle's `sql` template syntax.
2. **Ruby regex != JS regex** - Ruby's `m` flag (dotall) = JS's `s` flag. Several patterns in description extraction need adjustment. Ruby's `\A`/`\z` anchors have no direct JS equivalent.
3. **Date handling** - Ruby `Date.parse` is very flexible; JS `new Date()` is not. Use `date-fns` `parseISO` for git date formats.
4. **Shell pipe in git command** - `git log --format='%an' | sort -u` relies on shell piping. Use `Array.from(new Set(...))` in TS instead.
5. **`default_scope` on Note** - No Drizzle equivalent. Must explicitly order by `created_at desc` in every note query or wrap in a helper.
6. **ActiveRecord `find_or_initialize_by`** - No direct Drizzle equivalent. Implement as select-then-insert-or-update.
7. **Hono JSX async components** - Hono JSX supports `async` components natively, but return values must be `Promise<JSX.Element>`. Ensure DB queries are awaited properly.
8. **htmx CSRF** - Rails has built-in CSRF protection. With Hono, add CSRF middleware (e.g., `hono/csrf`) and include token in htmx requests via `hx-headers`.

## Vertical Slice Strategy

Rather than build horizontally (all models, all routes, all templates), implement 5 vertical slices:

### Slice 1: Foundation (DONE)

- Bun project setup
- Drizzle schema + migrations
- DB client + Zod validators
- Health endpoint
- **Status:** Implemented on `feat/foundation-scaffolding-db-schema` branch, needs P1/P2 review fixes

### Slice 2: Scanner MVP

- Port ProjectScanner + ProjectData
- CLI `scan` command
- Test on real repos
- Fixes: hardcoded cutoff date, missing `is_fork`, consolidate `bin/index_all_projects`

### Slice 3: Read Path

- Hono routes: `GET /projects`, `GET /projects/:id`
- Server templates: index + detail pages (Hono JSX)
- Filter form with query param handling
- Basic layout + Tailwind styling
- Vanilla JS: accordion, clickable rows, search debounce

### Slice 4: Write Path

- htmx inline CRUD routes for tags, notes, goals
- Pin/unpin project
- HTML fragment templates
- Copy path, quick actions (vanilla JS)

### Slice 5: Polish

- Sidebar layout (pinned projects, smart groups)
- Dark mode toggle
- Pagination + sorting
- Tests (Vitest)
- CI/CD

## Implementation Strategy: Vertical Slices

Rather than building each horizontal layer completely before moving to the next, the port follows a **vertical slice** approach — thin end-to-end slices that validate the stack works together, then widen.

### Slice 1: Foundation (DONE)

**Branch:** `feat/foundation-scaffolding-db-schema`
**Plan:** `docs/plans/2026-02-08-feat-foundation-scaffolding-and-db-schema-plan.md`

- Bun project with Hono, Drizzle, libSQL, Zod (4 prod deps, 3 dev deps)
- 6-table Drizzle schema matching Rails reference with all constraints, FKs, indexes
- SQLite PRAGMAs (foreign_keys, WAL mode)
- Drizzle `relations()` declarations for relational queries
- Zod validators for project insert + metadata JSON (15 fields)
- Health endpoint (`GET /api/health`)
- Ultracite/Biome linting

### Slice 2: Scanner MVP

- Port `ProjectScanner` (recursive git repo discovery, date filtering)
- Port `ProjectData` (metadata extraction via `simple-git`)
- Fix hardcoded cutoff date bug, missing `is_fork` attribute
- Consolidate `bin/index_all_projects` duplicate logic
- Minimal CLI `scan` command via `commander`
- DB persistence via `Project.createOrUpdate`

### Slice 3: Read Path

- Hono API endpoints for listing/filtering projects (`GET /api/projects`, `GET /api/projects/:id`)
- Port filter query builders (10 scopes with `json_extract()`)
- `GET /api/filters` and `GET /api/stats` for sidebar data
- Minimal React UI with Vite + TanStack Query + TanStack Router
- Projects table with filter bar
- Install frontend deps: React, Vite, Tailwind 4, TanStack Query/Router

### Slice 4: Write Path

- Tags, notes, goals CRUD API endpoints
- Toggle pin, track last viewed
- React mutations with TanStack Query (`useMutation`, optimistic updates)
- Tag/note/goal manager components
- URL search params for filter state

### Slice 5: Polish

- Remaining UI (sidebar, detail page, badges, Quick Resume cards)
- Pagination, sorting
- Responsive layout + mobile header
- Vitest + Testing Library test suite
- CI/CD configuration

### Why Vertical Slices

The port plan has several unknowns (`json_extract()` in Drizzle, `simple-git` behavior, Turbo-to-React mutation patterns) that are better validated early with working code. Each slice produces a runnable system that can be demonstrated and tested, rather than building a complete but untested layer.

## Effort Estimate

| Area                   | Original (SPA) | Revised (Server) | Delta               | Notes                                    |
| ---------------------- | -------------- | ---------------- | ------------------- | ---------------------------------------- |
| Project scaffolding    | 1 day          | 1 day            | Same                | Bun, Hono, Drizzle, Ultracite            |
| DB schema + validation | 2-3 days       | 2-3 days         | Same                | Slice 1 done                             |
| Scanning engine        | 2-3 days       | 2-3 days         | Same                | Nearly 1:1 port                          |
| Routes + filtering     | 2-3 days       | 2-3 days         | Same                | Routes exist, return HTML not JSON       |
| Frontend               | 5-7 days       | 2-3 days         | **-3 to -4 days**   | Server templates + htmx, no client state |
| CLI                    | 1 day          | 1 day            | Same                | Commander + JSON API routes              |
| Testing                | 2-4 days       | 2-3 days         | Slightly less       | No React component tests                 |
| CI/CD                  | 1 day          | 1 day            | Same                | GitHub Actions, Docker                   |
| **Total**              | **16-23 days** | **13-18 days**   | **~3-5 days saved** |

The server-rendered approach is simpler and faster to implement than the original SPA plan.
