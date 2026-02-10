# CLAUDE.md

## Overview

Project Dashboard is a TypeScript rewrite of a Rails 8.2 application that discovers, analyzes, and tracks active git repositories in a local development environment. It provides a web dashboard and CLI for browsing projects, filtering by tech stack/status, and managing tags, notes, and goals.

This is a **ground-up rewrite** — not an incremental port. The original Rails codebase serves as the reference implementation.

## Tech Stack

- **Runtime:** Bun
- **API Server:** Hono
- **Database:** SQLite via Turso / libSQL
- **ORM:** Drizzle
- **Validation:** Zod
- **Frontend:** React + Vite
- **Styling:** Tailwind 4
- **Data Fetching:** TanStack Query
- **Git Operations:** simple-git
- **CLI:** commander
- **Testing:** Vitest + Testing Library
- **Linting / Formatting:** Ultracite + Biome

## Reference Implementation

The original Rails 8.2 codebase is available as a btca resource named `your-project-dashboard` (configured in `./btca.config.jsonc`). Key reference files:

### Models & Schema
- `app/models/project.rb` — Main model with 10 scopes, JSON metadata queries, helper methods (171 lines)
- `app/models/goal.rb`, `note.rb`, `tag.rb`, `tagging.rb`, `project_goal.rb` — Simple supporting models
- `db/schema.rb` — 6 tables: projects, tags, taggings, notes, goals, project_goals

### Scanning Engine
- `lib/project_scanner.rb` — Recursive git repo discovery, date filtering, DB persistence (204 lines)
- `lib/project_data.rb` — Metadata extraction: git commands, tech stack detection, project type inference (398 lines)
- `lib/tasks/projects.rake` — CLI interface (2 tasks: scan, config)
- `bin/index_all_projects` — Standalone indexer script (has overlapping logic with scanner — consolidate in this port)

### Web UI
- `app/views/projects/index.html.erb` — Dashboard with Quick Resume cards, filter bar, paginated table
- `app/views/projects/show.html.erb` — Detail page with sidebar, activity timeline, tags/notes/goals
- `app/views/layouts/application.html.erb` — Sidebar layout with pinned projects, smart groups
- `app/controllers/concerns/filterable.rb` — Filter chaining logic (search, status, tech stack, type, ownership)
- `app/helpers/projects_helper.rb` — Badge rendering, sort links, filter helpers
- `app/javascript/controllers/` — 7 Stimulus controllers (accordion, clickable rows, search debounce, quick actions)

### Configuration
- `config/routes.rb` — RESTful routes for projects, tags, notes, goals
- `config/database.yml` — SQLite config
- `CLAUDE.md` — Full architecture docs for the Rails version

## Planning Documents

- `docs/typescript-port-plan.md` — Detailed migration plan with target structure, API endpoints, component inventory, effort estimates, and known risks

## Key Porting Notes

- The Rails app uses a JSON `metadata` column on projects queried via SQLite `json_extract()` — keep this pattern with Drizzle's `sql` template literals
- Turbo Stream inline CRUD (notes, tags, goals) becomes React mutations with TanStack Query
- Filter state moves from server sessions to URL search params
- All Tailwind classes from ERB templates can be copied directly into TSX
- Fix bugs from the original: hardcoded cutoff date in project_data.rb:51, missing `is_fork` attribute definition
- Consolidate duplicate scanning logic between ProjectScanner and bin/index_all_projects
