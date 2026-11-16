# KnowStack interaction contract

Visual ownership: [DESIGN.md](DESIGN.md). Existing API and server authorization remain authoritative.

- `/` is the study workspace; query search/filter URLs render focused results. `/tracks` is a category directory; `/tracks/:category` lists that category's guides. Counts represent published guides, never completion or enrollment.
- Home recommends the first article returned by the current API ordering. Recommendation is absent from filtered/search/saved views. No progress or personalized-learning claim is made.
- `/?bookmarked=1` requires authentication. Anonymous users see a sign-in prompt. Account changes reload article results. Saved guides use the existing server bookmark API; anonymous bookmarks are not stored.
- Search submits explicitly, preserves filter query state, and supports Enter. Native selects own difficulty/tag/sort. Clear filters preserves saved scope. Browser back/forward restores URL state.
- `useApi` remains the request owner. Reader results show an updating indicator while fetching instead of presenting retained data as current matches. Errors use ErrorBox with retry; empty results have a recovery link. Category directory supports loading and retry separately.
- Save controls have accessible names and pressed state. The workspace serializes saves, waits for success before changing state and announces failures inline. Removing a saved guide removes it from that view. Expired sessions open the existing authentication modal.
- Shell owns navigation. Desktop and mobile expose the same destinations; administrator links are role-gated. Native dialog provides mobile focus containment, Escape and restoration; route/query changes and backdrop close it. Background scrolling stops while open. Search keyboard shortcut uses the desktop input or mobile drawer input.
- AuthProvider/AuthModal own account access; server authorization remains unchanged. Account menu uses native details and closes on navigation/Escape; logout errors are visible.
- Ask retains native validation, similar-topic search, explicit local draft saving and existing submission states. No guaranteed response time or staff-review claim. Article retains TOC, listening, exports, copy and bookmarks; AI source labels describe drafting only.
- Canonical owners: Shell navigation/drawer, native select controls, Ask form, AuthModal auth dialog, Badge loading/errors, Icon symbols, Markdown content sanitation, index.css scrollbars/focus/motion. No table-selection, date or toast capability is introduced.
- English UI with system font fallbacks. Selected navigation exposes aria-current; bookmark selection exposes aria-pressed; decorative SVG is aria-hidden. Focus-visible must remain usable on every new control.
