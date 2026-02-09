---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, security]
dependencies: []
---

# Add Hono secureHeaders() middleware and CORS before Slice 3

## Problem Statement

No security headers (CSP, X-Content-Type-Options, etc.), CORS, or rate limiting on the Hono app. While currently local-only, these should be established before user-facing endpoints are added in Slice 3.

## Findings

- **Source:** security-sentinel agent (L4)
- **File:** `src/server/index.ts`

## Proposed Solutions

Add `secureHeaders()` middleware from `hono/secure-headers` now. Add CORS and rate limiting when Slice 3 endpoints are added.

## Acceptance Criteria

- [ ] `secureHeaders()` middleware applied to Hono app
- [ ] CORS configured when read endpoints are added

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review | — |
