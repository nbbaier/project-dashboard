---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, configuration, typescript]
dependencies: []
---

# Add jsxImportSource for Hono JSX in tsconfig.json

## Problem Statement

`tsconfig.json` sets `"jsx": "react-jsx"` but has no `jsxImportSource`. Since React is not a dependency (stack was simplified to Hono JSX + htmx), TypeScript will look for `react/jsx-runtime` when any `.tsx` file is added, causing a type-check failure.

## Findings

- **Source:** kieran-typescript-reviewer agent
- **Severity:** P1 (will break as soon as JSX is used in Slice 3)
- **File:** `tsconfig.json:8`
- **Evidence:** `package.json` has no React dependency. MEMORY.md confirms "Dropped React... Using Hono JSX."

## Proposed Solutions

### Option A: Add jsxImportSource (Recommended)
Add `"jsxImportSource": "hono/jsx"` to `compilerOptions`.
- **Pros:** Correct for Hono JSX, prevents type-check failures
- **Cons:** None
- **Effort:** Trivial (1 line)
- **Risk:** None

## Recommended Action

_To be filled during triage._

## Technical Details

- **Affected files:** `tsconfig.json`

## Acceptance Criteria

- [ ] `tsconfig.json` includes `"jsxImportSource": "hono/jsx"`
- [ ] A test `.tsx` file type-checks without React installed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |

## Resources

- PR #1: feat: add foundation scaffolding and database schema
