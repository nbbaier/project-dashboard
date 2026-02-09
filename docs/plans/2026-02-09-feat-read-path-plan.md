---
title: "feat: Read Path — Server-Rendered Dashboard with Filtering, Sorting, and Sidebar"
type: feat
date: 2026-02-09
slice: 3
branch: feat/read-path
depends_on: feat/scanner-mvp (merged), feat/foundation-scaffolding-db-schema (merged)
reviewed_by: DHH, Kieran, Simplicity
---

# feat: Read Path — Server-Rendered Dashboard

## Overview

Build the full read-only web dashboard: server-rendered HTML pages with Hono JSX, Drizzle query builders for filtering/sorting/pagination, sidebar navigation, and static asset pipeline. This is Slice 3 of 5 — it produces a usable, browsable project dashboard backed by data from the scanner (Slice 2).

After this slice, a user can: scan repos → visit the dashboard → browse, filter, sort, and paginate projects → view project details → pin/unpin projects → navigate via sidebar.

## Problem Statement

Slices 1 (schema) and 2 (scanner) established the data layer and population mechanism. There is no way to view, browse, or interact with the data yet. The only endpoint is `GET /api/health`.

## Proposed Solution

Port the Rails dashboard UI to Hono JSX server-rendered templates. The approach stays close to the Rails architecture: server renders full HTML pages, htmx handles partial updates (filters), vanilla JS handles micro-interactions (accordion, clickable rows).

### What's In Scope

- Hono routes: `GET /`, `GET /projects`, `GET /projects/:id`, `POST /projects/:id/pin`
- Layout with sidebar (pinned projects, recently viewed, smart groups)
- Projects index page: Quick Resume cards, filter form, sortable paginated table, active filter pills
- Project detail page: info, tech stack, commits, contributors, tags/notes/goals (read-only)
- Filter query builders (port of 10 ActiveRecord scopes + Filterable concern)
- Helper functions (status computation, relative dates, GitHub URL extraction)
- Pagination (manual LIMIT/OFFSET with count query)
- Static asset pipeline (Tailwind 4 via bun-plugin-tailwind, vanilla JS, vendored htmx)

### What's NOT In Scope (deferred)

- Tags/notes/goals CRUD (Slice 4 — Write Path)
- Mobile hamburger sidebar (Slice 5 — Polish)
- Dark mode toggle UI (Slice 5 — system preference only for now)
- Tests (Slice 5)
- CI/CD (Slice 5)

## Technical Approach

### New Dependencies

```
# Dev only
bun add -d tailwindcss bun-plugin-tailwind
```

htmx vendored into `public/htmx.min.js` (not CDN — this is a local tool that should work offline).

### Architecture

```
src/server/
  index.ts                    # Route mounting, middleware (logger, serveStatic), error handler
  routes/
    projects.ts               # GET /projects, GET /projects/:id, POST /projects/:id/pin
  views/
    layout.tsx                # Base HTML shell with sidebar slot
    sidebar.tsx               # Left rail: pinned, recent, smart groups (shared across pages)
    projects/
      index.tsx               # Index page: Quick Resume cards, filter form, table, pagination
      show.tsx                # Detail page: info, tech stack, commits, sidebar sections
    shared/
      badges.tsx              # StatusBadge, TechStackBadge, ForkBadge (shared across pages)
  lib/
    filters.ts                # Query builder + distinct-value queries + Zod param schema
    helpers.ts                # computeStatus(), relativeDate(), githubUrl()
src/client/
    main.ts                   # Vanilla JS: accordion, clickable rows, copy-to-clipboard, popstate handler
    styles.css                # Tailwind 4 imports
public/                       # Built assets (served by Hono serveStatic)
    htmx.min.js               # Vendored htmx (no CDN dependency)
    main.js
    styles.css
```

**File count: ~10 new source files** (down from ~15 in v1). Components start inline in their page files and get extracted only when a file exceeds ~300 lines.

### Key Technical Decisions

#### 1. No CSRF Protection

This is a localhost-only dashboard with no authentication or sessions. CSRF attacks exploit authenticated sessions — there is nothing to exploit here. No CSRF middleware, no meta tags, no htmx token config. If auth is added later, CSRF gets added then.

#### 2. Metadata JSON Parsing

Drizzle's `mode: "json"` on the metadata column auto-parses JSON on read with libSQL. This means `project.metadata` is already a typed `ProjectMetadata` object — no manual `JSON.parse` needed. Verify this works in Phase 1 with a quick test query. If it does not, add a centralized `parseMetadata()` function in `helpers.ts`.

#### 3. Query Composition — Drizzle Query Builder, Not Raw SQL

Use Drizzle's `db.select().from(projects).where(and(...conditions)).orderBy(...)` API for the filtered list query. Individual filter conditions use `sql` template literals (for `json_extract`, `json_each`, date arithmetic) but are composed via Drizzle's `and()` operator. This keeps type-safe column references for simple conditions (`eq(projects.isFork, false)`) and raw SQL only where needed.

For sorting, use Drizzle's `asc()`/`desc()` on column references for `name` and `lastCommitDate`. For `commit_count`, use `sql` since it requires `CAST(json_extract(...))`. Keep sorting in the query builder, not as raw ORDER BY fragments.

```typescript
// Composition pattern (pseudocode):
const conditions: SQL[] = [];
if (params.search) conditions.push(searchCondition(params.search));
if (params.status) conditions.push(statusCondition(params.status));
// ...

const where = conditions.length > 0 ? and(...conditions) : undefined;

const [results, countResult] = await Promise.all([
  db.select().from(projects).where(where).orderBy(orderBy).limit(25).offset(offset),
  db.select({ count: sql<number>`count(*)` }).from(projects).where(where),
]);
```

#### 4. Quick Resume Cards — Status Computed in TypeScript

Fetch 30 recent non-fork projects ordered by `lastCommitDate` desc. Compute `computeStatus()` on each in TypeScript (not SQL). Filter to `["active", "wip", "recent", "deployed"]`, take 12. This is simpler than duplicating the full status logic in SQL, and 30 rows is trivial to process.

#### 5. Smart Groups Are Status Filter Values

"Active this week" and "Stalled" are not a separate concept — they are values of the `status` filter. Sidebar links go to `/projects?status=active_this_week` and `/projects?status=stalled`. The query builder handles them as additional `case` branches in `statusCondition()`. No separate `smartGroup` parameter.

#### 6. htmx History — `popstate` Handler

After htmx swaps `#results` with `hx-push-url`, pressing browser Back changes the URL but does not update the page. Fix: add a `popstate` event listener in `main.ts` that triggers a full page reload on back/forward. This is ~5 lines of vanilla JS and avoids the complexity of htmx's history cache.

```typescript
// In src/client/main.ts
window.addEventListener("popstate", () => location.reload());
```

#### 7. Filter Form — `hx-include` on Whole Form

Instead of individual selects with hidden inputs for other filters, use `hx-include="closest form"` so htmx submits the entire filter form as one unit. This prevents filter state duplication in hidden fields and is simpler to implement.

#### 8. `updatedAt` — Accept the Inaccuracy

When `last_viewed_at` is updated on project view, the `AFTER UPDATE` trigger will also bump `updatedAt`. This is fine — `updatedAt` means "when the row was last modified," and viewing does modify the row. No trigger guard needed. Simple Drizzle update:

```typescript
await db.update(projects).set({ lastViewedAt: new Date() }).where(eq(projects.id, id));
```

#### 9. Prev/Next Navigation — By Current Sort Order

Prev/Next on the detail page should respect the sort order the user came from, not raw database ID. Pass `sort` and `direction` as query params to the detail page URL. The show route uses these to find the adjacent projects. If no sort params are present, default to `lastCommitDate desc`.

#### 10. Mobile Layout — Graceful Degradation

Sidebar is hidden on mobile via `hidden lg:block`. Content goes full-width. No hamburger menu in this slice — deferred to Slice 5.

### Implementation Phases

#### Phase 1: Infrastructure + Helpers

Set up the skeleton so we can render and test pages immediately.

- [x] Install `tailwindcss` and `bun-plugin-tailwind` as dev dependencies
- [x] Vendor `htmx.min.js` into `public/` directory
- [x] Create `src/client/styles.css` with Tailwind 4 `@import "tailwindcss"` directive
- [x] Create `src/client/main.ts` with vanilla JS (~40 lines):
  - Accordion toggle (click to show/hide sections)
  - Clickable table rows (`data-href` attribute → `window.location`)
  - Copy-to-clipboard for project path
  - `popstate` event listener → `location.reload()` for htmx history
- [x] Add build scripts to `package.json`:
  - `"build:client": "bun build src/client/main.ts --outdir public --target browser"`
  - `"build:css": "bun build src/client/styles.css --outdir public"` (with tailwind plugin)
  - `"build": "bun run build:client && bun run build:css"`
- [x] Create `bunfig.toml` with `bun-plugin-tailwind` plugin config
- [x] Update `src/server/index.ts`:
  - Add `logger()` middleware (first in chain)
  - Add `serveStatic({ root: "./public" })` middleware (before routes)
  - Add `GET /` redirect to `/projects`
  - Add `notFound` handler: `c.text("Not found", 404)`
  - Add `onError` handler: `c.text("Internal error", 500)` (log the error)
  - Mount project routes from `routes/projects.ts`
- [x] Create `src/server/views/layout.tsx` — base HTML with:
  - `<head>`: charset, viewport, title, `<link>` to `/styles.css`
  - `<body>`: sidebar slot + main content slot
  - `<script src="/htmx.min.js">` and `<script src="/main.js">`
- [x] Verify metadata JSON auto-parsing: run a quick `db.select().from(projects).limit(1)` and confirm `project.metadata` is already a parsed object (not a string). If not, add `parseMetadata()` to helpers.
- [x] Create `src/server/lib/helpers.ts` (3 functions with real logic):

  ```typescript
  type Status = "active" | "recent" | "paused" | "wip" | "deployed" | "unknown";

  // Port of Project#status — consistent logic for both display and filtering
  // Checks WIP|TODO|FIXME|in progress (case-insensitive) in lastCommitMessage
  // Checks deployment_status in metadata
  // Falls back to commit recency: <7d active, <30d recent, else paused
  export function computeStatus(project: ProjectSelect): Status

  // Port of Project#relative_last_commit_date
  // Returns: "today", "yesterday", "3 days ago", "2 weeks ago", "3 months ago", "1 year ago"
  export function relativeDate(isoDate: string): string

  // Port of Project#github_url
  // Converts SSH git@github.com:user/repo.git → https://github.com/user/repo
  // Returns null if no GitHub remote
  export function githubUrl(metadata: ProjectMetadata | null): string | null
  ```

  Use `typeof projects.$inferSelect` as the `ProjectSelect` type alias. Trivial metadata accessors (`metadata?.techStack ?? []`) are inlined at call sites, not wrapped in helper functions.

- [x] Create `src/server/lib/filters.ts` — query builder + param validation:

  ```typescript
  import { z } from "zod";

  // Zod schema for parsing + validating URL query params
  // Coerces page to number, falls back to defaults for invalid values
  export const filterParamsSchema = z.object({
    search: z.string().optional(),
    ownership: z.enum(["own", "forks"]).optional(),
    status: z.enum(["active", "recent", "paused", "wip", "deployed",
                     "active_this_week", "stalled"]).optional(),
    techStack: z.string().optional(),
    type: z.string().optional(),
    sort: z.enum(["name", "last_commit_date", "commit_count"]).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
  });
  export type FilterParams = z.infer<typeof filterParamsSchema>;

  // Main query function — returns paginated results
  // Composes WHERE conditions via Drizzle's and() operator
  // Runs data query + count query in parallel via Promise.all
  export async function queryProjects(params: FilterParams): Promise<{
    results: ProjectSelect[];
    totalCount: number;
    page: number;
    perPage: number;
  }>

  // Sidebar data — 3 queries, run in parallel
  export async function loadSidebarData(): Promise<{
    pinnedProjects: ProjectSelect[];      // up to 15, ordered by name
    recentlyViewed: ProjectSelect[];      // up to 10, ordered by lastViewedAt desc
    activeThisWeekCount: number;
    stalledCount: number;
  }>

  // Filter dropdown options — query directly, no cache
  // Local SQLite with <500 rows completes in microseconds
  export async function distinctTechStacks(): Promise<string[]>
  export async function distinctProjectTypes(): Promise<string[]>
  ```

  **Filter conditions (private functions):**

  | Condition | SQL Pattern |
  |-----------|-------------|
  | `searchCondition(q)` | `name LIKE ? OR path LIKE ? OR last_commit_message LIKE ? OR json_extract(metadata, '$.description') LIKE ?` |
  | `statusCondition("active")` | `date(substr(last_commit_date, 1, 10)) >= date('now', '-7 days')` |
  | `statusCondition("recent")` | Between 7 and 30 days ago |
  | `statusCondition("paused")` | Older than 30 days |
  | `statusCondition("wip")` | `(last_commit_message LIKE '%WIP%' OR ... LIKE '%TODO%' OR ... LIKE '%FIXME%' OR ... LIKE '%in progress%') OR json_extract(metadata, '$.current_state') LIKE '%work in progress%'` |
  | `statusCondition("deployed")` | `json_extract(metadata, '$.deployment_status') LIKE '%likely deployed%'` |
  | `statusCondition("active_this_week")` | Same as "active" (alias) |
  | `statusCondition("stalled")` | Between 14 and 60 days ago |
  | `techStackCondition(t)` | `EXISTS (SELECT 1 FROM json_each(json_extract(metadata, '$.tech_stack')) WHERE value = ?)` |
  | `typeCondition(t)` | `json_extract(metadata, '$.inferred_type') = ?` |
  | `ownershipCondition("own")` | `is_fork = 0` |
  | `ownershipCondition("forks")` | `is_fork = 1` |

  **Key fixes from Rails:**
  - **Status consistency:** Both `statusCondition("wip")` and `computeStatus()` check the same broad pattern (WIP/TODO/FIXME/in progress + current_state metadata)
  - **Tech stack accuracy:** `json_each()` for exact array element matching instead of `LIKE` (prevents "go" matching "django")
  - **No `"all"` values:** Absence of a filter = `undefined`, not a magic string. If `status` is not provided, no status condition is added.

  **Sorting:**

  | Sort | Drizzle |
  |------|---------|
  | `name` | `asc(projects.name)` / `desc(projects.name)` |
  | `last_commit_date` (default) | `asc(projects.lastCommitDate)` / `desc(projects.lastCommitDate)` |
  | `commit_count` | `sql\`CAST(COALESCE(json_extract(metadata, '$.commit_count_8m'), 0) AS INTEGER)\`` with `asc`/`desc` |

  Default sort direction: `asc` for `name`, `desc` for `last_commit_date` and `commit_count`.

**Files:** `package.json`, `bunfig.toml`, `src/client/styles.css`, `src/client/main.ts`, `src/server/index.ts`, `src/server/views/layout.tsx`, `src/server/lib/helpers.ts`, `src/server/lib/filters.ts`

#### Phase 2: Index Page (the main dashboard view)

Build the entire index page end-to-end. Components start inline in `index.tsx` and get extracted only if the file exceeds ~300 lines.

- [x] Create `src/server/views/shared/badges.tsx` — shared badge components:
  - `StatusBadge` — colored pill with dot indicator (green/blue/gray/amber/emerald). Copy Tailwind classes directly from `projects_helper.rb` lines 4-29. Include `dark:` variants.
  - `TechStackBadge` — gray pill with emoji icon per tech
  - `ForkBadge` — small "Fork" indicator
  - `ProjectTypeBadge` and `GoalBadge` start inline in `show.tsx` (only used there)

- [x] Create `src/server/views/sidebar.tsx` — layout-level sidebar:
  - Pinned projects list (up to 15, ordered by name) with bookmark icons
  - Recently viewed list (up to 10, ordered by lastViewedAt desc)
  - Smart groups: "Active this week" and "Stalled" with counts, linking to `?status=active_this_week` and `?status=stalled`
  - "Project Dashboard" header and nav link

- [x] Create `src/server/views/projects/index.tsx` — single file containing:
  - **Header** with project count + active filter count
  - **Quick Resume cards** — 3-column grid (up to 12 cards). Each card: name, status badge, GitHub link, truncated commit message, relative date, fork badge, tech stack (up to 4). Shown only when no filters active and page 1.
  - **Filter form** — search input (`hx-trigger="input changed delay:300ms"`), 4 select dropdowns (Ownership, Status, Tech Stack, Type). Form uses `hx-get="/projects"`, `hx-target="#results"`, `hx-swap="innerHTML"`, `hx-push-url="true"`. Use `hx-include="closest form"` so htmx submits the whole form. Pre-fill values from current query params.
  - **`<div id="results">`** containing:
    - Active filter pills with "×" dismiss links (each removes one filter param from URL)
    - "Clear all" link when any filters active
    - Sortable table: columns Project (name + fork badge), Status (badge), Last Activity (relative date, `hidden sm:table-cell` on mobile). Sort headers preserve filter state, `aria-sort` attribute, direction arrow. Clickable rows via `data-href`.
    - Empty state: "No projects found" (different message if filters active vs. zero projects in DB)
    - Pagination: "Showing X–Y of Z projects", page numbers (window 2), Prev/Next buttons. Preserve filter + sort params.
    - Accessible: `<caption class="sr-only">`, `<th scope="col">`
  - Extract components to top-of-file functions as needed (not separate files unless > 300 lines)

- [x] Create `src/server/routes/projects.ts` — index route:

  ```typescript
  import { filterParamsSchema, queryProjects, loadSidebarData,
           distinctTechStacks, distinctProjectTypes } from "../lib/filters.ts";

  app.get("/projects", async (c) => {
    // 1. Parse query params through Zod schema (invalid values fall back to defaults)
    const params = filterParamsSchema.parse(c.req.query());

    // 2. Run data queries in parallel
    const [projectsResult, sidebarData, techStacks, projectTypes, quickResumeRaw] =
      await Promise.all([
        queryProjects(params),
        loadSidebarData(),
        distinctTechStacks(),
        distinctProjectTypes(),
        // 30 recent non-fork projects for Quick Resume
        db.select().from(projects)
          .where(eq(projects.isFork, false))
          .orderBy(desc(projects.lastCommitDate))
          .limit(30),
      ]);

    // 3. Compute Quick Resume cards (status in TypeScript, filter + take 12)
    const quickResume = quickResumeRaw
      .filter(p => ["active", "wip", "recent", "deployed"].includes(computeStatus(p)))
      .slice(0, 12);

    // 4. If htmx request, return only #results fragment
    if (c.req.header("HX-Request")) {
      return c.html(<Results ... />);
    }

    // 5. Full page with layout
    return c.html(
      <Layout sidebar={<Sidebar data={sidebarData} />}>
        <ProjectsIndex ... />
      </Layout>
    );
  });
  ```

**Files:** `src/server/views/shared/badges.tsx`, `src/server/views/sidebar.tsx`, `src/server/views/projects/index.tsx`, `src/server/routes/projects.ts`

#### Phase 3: Detail Page + Pin/Unpin

- [x] Create `src/server/views/projects/show.tsx`:
  - 4-column grid: 1 sidebar + 3 main content
  - **Main content sections:**
    - Header: project name, pin toggle button (`<form method="POST" action="/projects/:id/pin">`), status badge, fork badge, deployed badge
    - Overview: description (or `metadata.claudeDescription` fallback)
    - Tech Stack: badge grid
    - Recent Activity: commit timeline from `metadata.recentCommits` (date, message)
    - Contributors: list from `metadata.contributors`
    - Reference Files: accordion (collapsed by default) from `metadata.referenceFiles`
  - **Detail sidebar sections:**
    - Quick Actions: Open in VS Code (`vscode://file/<path>`), Open GitHub (if URL available), Copy Path (clipboard button)
    - Details: path, project type badge (inline), commit count, last commit date
    - Tags: read-only list — `<div id="project-tags">` (Slice 4 adds CRUD)
    - Notes: read-only list, ordered by createdAt desc — `<div id="project-notes">` (Slice 4 adds CRUD)
    - Goals: read-only list with inline goal status badges — `<div id="project-goals">` (Slice 4 adds CRUD)
    - Prev/Next navigation links (respects current sort order via query params)

- [x] Add show route to `src/server/routes/projects.ts`:

  ```typescript
  app.get("/projects/:id", async (c) => {
    const id = Number.parseInt(c.req.param("id"));
    if (Number.isNaN(id)) return c.text("Not found", 404);

    // Load project with relations using Drizzle relational query
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        taggings: { with: { tag: true } },
        notes: { orderBy: [desc(notes.createdAt)] },
        projectGoals: { with: { goal: true } },
      },
    });

    if (!project) return c.text("Not found", 404);

    // Update last_viewed_at (updatedAt will also bump — that's fine)
    await db.update(projects).set({ lastViewedAt: new Date() }).where(eq(projects.id, id));

    // Prev/Next respecting sort order from query params
    const sort = c.req.query("sort") ?? "last_commit_date";
    const direction = c.req.query("direction") ?? "desc";
    const [prev, next] = await findAdjacentProjects(project, sort, direction);

    const sidebarData = await loadSidebarData();

    return c.html(
      <Layout sidebar={<Sidebar data={sidebarData} />}>
        <ProjectShow project={project} prev={prev} next={next} />
      </Layout>
    );
  });
  ```

- [x] Add pin route:

  ```typescript
  app.post("/projects/:id/pin", async (c) => {
    const id = Number.parseInt(c.req.param("id"));
    if (Number.isNaN(id)) return c.text("Not found", 404);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      columns: { id: true, pinned: true },
    });

    if (!project) return c.text("Not found", 404);

    await db.update(projects)
      .set({ pinned: !project.pinned })
      .where(eq(projects.id, id));

    // Redirect back to referrer, or project detail page
    const referer = c.req.header("Referer");
    return c.redirect(referer ?? `/projects/${id}`);
  });
  ```

- [x] Run `bun x ultracite fix` and verify lint passes
- [ ] Manual smoke test: scan some repos, browse the dashboard, test filters, pagination, sorting, pin/unpin, detail page, browser back/forward

**Files:** `src/server/views/projects/show.tsx`, `src/server/routes/projects.ts` (show + pin routes added)

## Acceptance Criteria

### Functional

- [ ] `GET /` redirects to `/projects`
- [ ] `GET /projects` renders the full index page with Quick Resume cards, filter form, table, pagination
- [ ] Filtering by search, ownership, status, tech_stack, type works independently and in combination
- [ ] Filter state is reflected in URL query params (bookmarkable)
- [ ] htmx partial updates work: changing a filter swaps only the `#results` area
- [ ] `hx-push-url` keeps browser URL in sync with filter state
- [ ] Browser back/forward works correctly (via `popstate` → reload)
- [ ] Sorting by name, last_commit_date, commit_count works with direction toggle
- [ ] Pagination shows correct page counts and navigates correctly
- [ ] Status filter values `active_this_week` and `stalled` work as sidebar smart group links
- [ ] Active filter pills show and dismiss correctly
- [ ] `GET /projects/:id` renders the detail page with all sections
- [ ] Viewing a project updates `last_viewed_at`
- [ ] `POST /projects/:id/pin` toggles pin status and redirects back
- [ ] Sidebar shows pinned projects, recently viewed, smart group counts
- [ ] 404 returns plain text for invalid/non-existent project IDs
- [ ] Tailwind CSS is processed and served correctly
- [ ] All content renders with dark mode `dark:` variants (system preference)
- [ ] Invalid query params are silently ignored (fall back to defaults, no 400 errors)

### Non-Functional

- [ ] No `any` types — all TypeScript is properly typed
- [ ] `ProjectSelect` type alias used consistently (from `typeof projects.$inferSelect`)
- [ ] `bun x ultracite check` passes clean
- [ ] Pages render in < 200ms for typical dataset (< 500 projects)
- [ ] Semantic HTML: proper heading hierarchy, `<table>` with `<caption>`, `aria-sort` on sortable columns
- [ ] Parameterized SQL queries only — no string interpolation in SQL
- [ ] Middleware order: `logger()` → `serveStatic()` → routes

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `json_each()` not supported in libSQL | Low | High | libSQL supports full SQLite JSON functions; test early in Phase 1 |
| Hono JSX async components have gotchas | Medium | Medium | Test with a simple async component in Phase 1 |
| `bun build` + tailwind plugin has config issues | Medium | Low | Fall back to postcss CLI if needed |
| Drizzle `mode: "json"` doesn't auto-parse with libSQL | Low | Medium | Verify in Phase 1; add `parseMetadata()` fallback if needed |
| Drizzle relational queries issue N+1 for Quick Resume cards | Medium | Low | Quick Resume uses plain `select()`, not relational queries. Only show page uses `with:` for a single project. |

## Updated Slice Boundaries

After absorbing sidebar/pagination/sorting into Slice 3:

| Slice | Contents | Status |
|-------|----------|--------|
| 1. Foundation | Scaffolding, DB schema, validators | Done |
| 2. Scanner MVP | ProjectScanner, ProjectData, CLI scan | Done |
| **3. Read Path** | **Routes, templates, filters, pagination, sorting, sidebar, pin/unpin, asset pipeline** | **This plan** |
| 4. Write Path | Tags/notes/goals CRUD via htmx, htmx fragment routes | Next |
| 5. Polish | Mobile sidebar, dark mode toggle, responsive polish, tests, CI | Final |

## References

### Internal

- Rails controller: `app/controllers/projects_controller.rb` (in btca resource `your-project-dashboard`)
- Rails filterable: `app/controllers/concerns/filterable.rb` (in btca resource `your-project-dashboard`)
- Rails helpers: `app/helpers/projects_helper.rb` (in btca resource `your-project-dashboard`)
- Rails model (scopes): `app/models/project.rb` (in btca resource `your-project-dashboard`)
- Drizzle schema: `src/server/db/schema.ts`
- Port plan: `docs/typescript-port-plan.md`
- Stack simplification brainstorm: `docs/brainstorms/2026-02-08-simplify-frontend-stack-brainstorm.md`
- Foundation plan: `docs/plans/2026-02-08-feat-foundation-scaffolding-and-db-schema-plan.md`
- Scanner plan: `docs/plans/2026-02-09-feat-scanner-mvp-plan.md`

### External

- [Hono JSX documentation](https://hono.dev/docs/guides/jsx)
- [htmx documentation](https://htmx.org/docs/)
- [Drizzle ORM SQL operators](https://orm.drizzle.team/docs/operators)
- [SQLite JSON functions](https://www.sqlite.org/json1.html)
- [bun-plugin-tailwind](https://github.com/nicklasoverby/bun-plugin-tailwind)
