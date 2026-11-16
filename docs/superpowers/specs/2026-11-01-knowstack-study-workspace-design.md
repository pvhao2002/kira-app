# KnowStack study workspace

Status: approved by user and implemented.

## Intent
Help developers choose an interview-preparation track, study a guide, and return to saved material. Replace the catalog-heavy opening with a calm, useful study desk. Keep React, existing APIs, authentication, markdown sanitization, and administrator permissions.

## Screen structure
- `/`: Study workspace. Compact heading “What are you studying today?”, a primary “Explore tracks” action, a saved-guides entry, and a recommended guide from the existing article response. Show a short selection of track links with real guide counts, followed by browsable guides. Keep search, difficulty, tag, and sort controls compact; retain query-string filtering and bookmark URLs.
- `/tracks`: Dedicated track directory, distinct from the workspace. Display each real category, published guide count, and an “Explore track” link. Empty tracks say “No guides yet”; no implied enrollment, sequence, or completion.
- `/tracks/:category`: Track heading and description, compact filters, and guide list. Existing category data defines membership; do not imply a pedagogical order. Preserve existing ordering behavior.
- `/?bookmarked=1`: Saved guides with a clear heading, existing account access, and useful empty/error states. No fabricated saved counts or anonymous persistence.
- `/articles/:slug`: Quiet reading layout, category breadcrumb, readable measure, visible save action, existing table of contents, export/listen functions. Source labels describe AI drafting without claiming staff review that the data cannot establish.
- `/ask`: Same visual system and existing form behavior, local draft saving, similar questions, and submission feedback. Remove unverified turnaround and review promises in touched copy.
- Admin: inherit shared visual tokens and navigation; preserve routes, authorization, and operational behavior. No redesign of publishing or agent lifecycle in this change.

## Navigation
Desktop left rail: Study workspace, Interview tracks, Saved guides, Ask a question; category shortcuts below. Admin links remain role-gated. Header contains brand, search, and account controls. Remove duplicate top navigation. Mobile provides an accessible drawer with the same destinations and usable search; close on route/query navigation, Escape, and backdrop, restore focus, prevent background interaction while open.

## Visual direction
A technical study desk: ink navy canvas, slightly lighter slate panels, indigo for primary actions, mint only for positive state. Keep the existing dark identity, replacing stacked inset panels with clear sections and restrained borders. Signature: a track directory with compact technical symbols and visible guide counts, paired with a prominent recommended reading panel.

Proposed core tokens: canvas #0B1326, panel #131B2E, elevated #222A3D, text #DAE2FD, muted #C7C4D7, primary #C0C1FF, positive #4EDEA3. Geist headings, Inter body, JetBrains Mono metadata, with system fallbacks. Use 32px screen headings, 20–24px card headings, 15px body, 13px secondary copy; 68ch reading measure. Controls 40px minimum, icon targets 44px on touch. Panels 8px radius, controls 6px, pills reserved for status. Runtime CSS is the canonical token owner; new root DESIGN.md records the approved values and mapping. Reconcile conflicting legacy mockup prose explicitly.

## Behavior and ownership
Reuse useApi, AuthProvider, ErrorBox, Spinner, badges, and Markdown. Native selects remain the filter owner. Keep errors recoverable with retry, distinguish loading from empty results, expose selected filters and bookmark state to assistive technology, and keep focus visible. Use local inline feedback for bookmark failures and busy state to avoid duplicate requests. Replace fragile icon-font dependencies in the touched shared/navigation and study screens with one reusable local SVG icon owner; decorative symbols are hidden from assistive technology and actions have names.

Create UX-CONTRACT.md documenting navigation, filters, saving, authentication, form submission, drawer focus, async recovery, and shared control ownership. English UI; no evidence of a Japan-market requirement. No new dependencies, backend schema, completion tracking, streaks, scheduling, enrollment, or external side effects.

## Verification and acceptance
Focused tests for new route/view selection and filter/navigation behavior, then module-required Vitest and TypeScript checks. Inspect rendered desktop and mobile workspace, track directory/detail, saved state, article, Ask, and auth drawer/modal keyboard behavior where accessible. Confirm guides appear earlier, tracks have a distinct destination, all actions work, and layouts do not overflow. Run graph change analysis; report unresolved graph uncertainty rather than claiming a clean result.

## Scope and risk
Main targets: Shell, Library, route wiring, Article/Ask touched presentation, shared icons, index.css, root design and behavior documents. Graph impact currently reports CRITICAL for Shell and Library with one direct caller each and broad cross-module transitive results. Verify graph context and source imports before implementation; warn and retain the reported risk. Do not commit, deploy, or change domain/security behavior.

## Builder review clarifications
- Category API has no descriptions: supporting copy uses real guide counts.
- Recommended reading means the first returned article on the unfiltered workspace; hide it when searching, filtering, or viewing saved guides.
- Anonymous saved-guide visits show a sign-in prompt; reload saved data when authentication changes.
- While filters update, announce loading and do not present retained old results as matches for the new selection.
- Laptop acceptance target: first guide title and reading action visible at 1280×800. Mobile target: 390px wide with no horizontal page overflow.
- Graph context confirms App.tsx as the direct shell caller, but reports the index four commits behind HEAD. Refresh before relying on final impact results or editing product code. Current CRITICAL results remain unresolved, not an all-clear.
