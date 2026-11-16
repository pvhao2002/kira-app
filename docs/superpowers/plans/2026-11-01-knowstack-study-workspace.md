# KnowStack Study Workspace Implementation Plan

> Execution: executing-plans, inline in the current session. No commits.

Goal: Implement the approved study workspace using current APIs and React.
Spec: docs/superpowers/specs/2026-11-01-knowstack-study-workspace-design.md

## Constraints
Preserve authorization, API contracts, markdown sanitation and existing article actions. No new dependencies, backend changes, progress scores or claims of editorial review. Shared CSS owns tokens.

## Review focus
Anonymous saved visits require sign-in; authentication changes reload saved results. New filters cannot display old matches while loading. Track directory must differ from home. Empty tracks remain browsable. Mobile navigation must retain focus and close on navigation/Escape.

## Tasks
- [x] 1. Add failing SSR tests for the shared workspace presentation: track directory and empty counts, guide links/bookmark state, and selected route mode. Run to confirm failure, then implement shared study components and route-mode helper. Existing Shell and Library impact reports are CRITICAL; direct caller is App.tsx. Refresh graph if available, otherwise report unresolved staleness.
- [x] 2. Replace Library presentation with workspace, track directory/detail and saved views, reusing API/auth/badge owners. Test authenticated saved data refreshing and filter-loading behavior in browser; ensure selected controls and failure recovery.
- [x] 3. Update Shell with one sidebar navigation and accessible mobile dialog; local SVG icons for touched components. Update article/Ask copy and controls; preserve business behavior. Review impact before each existing symbol change.
- [x] 4. Reconcile runtime radii, focus, scrollbar and reduced motion; write root DESIGN.md and UX-CONTRACT.md. Run module Vitest and TypeScript checks. Inspect desktop 1280x800 and mobile 390px, track/filter/saved/article/Ask behavior. Run graph detect_changes and review diff. Report actual outcomes and blockers.

## Verification record
48 tests passed after review fixes; TypeScript passed. Browser checked desktop 1280×800 and mobile 390×844: workspace recommendation/action, dedicated tracks, category filtering/empty state, anonymous saved prompt, current-destination drawer dismissal, Ask and article width. Signed-in browser saving and authenticated admin workflows were not manually exercised. Review fixed stale save-result race by refetching current query, same-route drawer dismissal, and missing SVG mappings. Graph detect_changes returned 16 changed symbols and 8 affected flows, high risk, without partial/truncated flags; MCP metadata still reports four commits behind despite successful CLI refresh, so freshness metadata remains uncertain. No commits or deployment. No new ponytail deferrals.
