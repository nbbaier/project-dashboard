# Brainstorm: Simplify Frontend Stack — Drop SPA, Use Bun-Native Serving

**Date:** 2026-02-08
**Status:** Complete

## What We're Building

A server-rendered Project Dashboard using Bun's built-in capabilities instead of a full React SPA. The key insight: the Rails reference app is fundamentally server-rendered HTML with ~220 lines of Stimulus JS for minor interactions (accordion, search debounce, clickable rows, inline CRUD). Porting this to a React SPA with TanStack Query, TanStack Router, and Vite adds significant complexity to replicate behavior that works naturally with server rendering.

## Why This Approach

### The Rails App's Actual Interactivity

Auditing the 7 Stimulus controllers and the ERB templates reveals:

| Interaction | Rails Implementation | Complexity |
|---|---|---|
| Filter/search projects | Turbo Frame swaps table on form submit | Server-rendered |
| Add/remove tags | Turbo Frame inline form | Server-rendered |
| Add/delete notes | Turbo Frame inline form | Server-rendered |
| Add/manage goals | Turbo Frame inline form | Server-rendered |
| Pin/unpin project | `button_to` POST | Server-rendered |
| Accordion (docs) | Stimulus toggle class | ~10 lines JS |
| Clickable table rows | Stimulus click handler | ~10 lines JS |
| Search debounce | Stimulus setTimeout | ~15 lines JS |
| Quick actions | Stimulus clipboard/shell | ~20 lines JS |
| Copy path | Stimulus clipboard API | ~5 lines JS |

**Zero client-side state management.** Every data mutation is a form submission that returns HTML. The only JS is UI micro-interactions.

### What We Eliminate

| Dependency | Purpose | Why It's Unnecessary |
|---|---|---|
| React + ReactDOM | Client rendering | Server JSX via Hono covers templating |
| TanStack Query | Data fetching/caching | No client state to manage — server returns HTML |
| TanStack Router | Client routing | Full page navigations, like Rails |
| Vite | Bundling/HMR | Bun.serve() handles bundling natively |

### What We Gain

- **~4 fewer production dependencies** (React, ReactDOM, TanStack Query, TanStack Router)
- **~2 fewer dev dependencies** (Vite, @vitejs/plugin-react)
- **No API serialization layer** — routes query DB and return HTML directly, no JSON endpoints needed for the UI
- **Faster page loads** — no JS bundle to download, parse, and hydrate
- **Simpler mental model** — request comes in, query DB, render HTML, send response. Same as Rails

## Key Decisions

### 1. Server Templating: Hono JSX

Use `hono/jsx` for server-side HTML rendering. Write `.tsx` files that compile to HTML strings — no React runtime needed. Hono JSX supports:
- Layouts and fragments
- Async components (can `await` DB queries inline)
- Streaming responses

Templates will look nearly identical to the ERB originals, with Tailwind classes copied directly.

### 2. Client Interactivity: htmx

Replace Turbo Frames with htmx (~14kb). The mental model is almost identical:
- `hx-post="/projects/1/tags"` replaces `data-turbo-frame`
- `hx-target="#project_tags"` replaces `turbo_frame_tag`
- `hx-swap="innerHTML"` replaces Turbo Stream actions
- Server returns HTML fragments, not JSON

For the remaining micro-interactions (accordion, search debounce, copy path), write vanilla JS — roughly ~60 lines total.

### 3. Bundling & Static Assets

Hono handles all routing and server-side JSX rendering. Bun serves as the HTTP runtime via `Bun.serve({ fetch: app.fetch })`.

For the small amount of client-side code (~60 lines of vanilla JS + htmx + Tailwind CSS):
- Use `bun build` to bundle client JS and process CSS into a `public/` directory
- Serve `public/` as static files via Hono's `serveStatic()` middleware
- `bun-plugin-tailwind` for Tailwind 4 processing during the build step
- In dev, re-run the build on change (or use Bun's `--watch` flag)

No Vite, no Webpack. Bun's bundler handles the minimal client assets.

### 4. Routing: Hono Server Routes

Keep Hono for routing, but routes return HTML instead of JSON:

```
GET  /                    → redirect to /projects
GET  /projects            → index page (server-rendered HTML)
GET  /projects/:id        → detail page (server-rendered HTML)
POST /projects/:id/pin    → toggle pin, redirect back
POST /projects/:id/tags   → add tag, return HTML fragment (htmx)
DELETE /projects/:id/tags/:tagId → remove tag, return HTML fragment
POST /projects/:id/notes  → add note, return HTML fragment
DELETE /projects/:id/notes/:noteId → delete note, return HTML fragment
POST /projects/:id/goals  → add goal, return HTML fragment
PATCH /projects/:id/goals/:goalId → update status, return HTML fragment
DELETE /projects/:id/goals/:goalId → delete goal, return HTML fragment
GET  /api/scan            → trigger scan (keep as JSON for CLI)
GET  /api/health          → health check (keep as JSON)
```

Most routes return HTML. Only CLI-facing endpoints return JSON.

### 5. What Stays the Same

These decisions from the original plan remain unchanged:
- **Runtime:** Bun
- **API Server:** Hono
- **Database:** SQLite via libSQL
- **ORM:** Drizzle
- **Validation:** Zod
- **Styling:** Tailwind 4
- **CLI:** commander
- **Testing:** Vitest
- **Git operations:** simple-git
- **Linting:** Ultracite + Biome

## Revised Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Runtime | Bun | Same |
| Server/Router | Hono | Same, but routes return HTML |
| Templating | Hono JSX | Replaces React + ERB |
| Database | SQLite / libSQL | Same |
| ORM | Drizzle | Same |
| Validation | Zod | Same |
| Interactivity | htmx | Replaces Turbo Frames |
| Styling | Tailwind 4 | Same |
| Bundling | `bun build` + bun-plugin-tailwind | Replaces Vite |
| Client JS | Vanilla (~60 lines) | Replaces 7 Stimulus controllers |
| CLI | commander | Same |
| Testing | Vitest | Same |
| Linting | Ultracite + Biome | Same |

## Revised Vertical Slices

The slice strategy stays the same, but slices 3-4 get simpler:

1. **Foundation** — scaffolding + DB schema (done, needs review fixes)
2. **Scanner MVP** — port ProjectScanner + ProjectData + CLI `scan` command
3. **Read path** — Hono routes returning server-rendered HTML pages (index + detail). htmx for filter form. Vanilla JS for accordion/search/clickable rows
4. **Write path** — htmx-powered inline CRUD for tags, notes, goals. Pin/unpin toggle
5. **Polish** — sidebar layout, dark mode, pagination, sorting, tests, CI

## Open Questions

1. **Static asset serving in dev** — Need a lightweight dev workflow for the client JS/CSS. Options: `bun build --watch` writing to `public/`, or Hono middleware that builds on-demand. Decide during planning.
2. **htmx: CDN vs bundled** — CDN `<script>` tag is simplest. Bundling with `bun build` is more self-contained. Low stakes either way.
3. **Dark mode** — Small script to toggle `dark` class on `<html>` and persist to localStorage. ~10 lines, not a blocker.
