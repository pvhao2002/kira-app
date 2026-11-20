# Frontend refactor log (matchmind-web, TypeScript logic)

Behaviour-preserving work on the Angular 22 client. `core/api.service.ts` stays the only HTTP client. No API contract
change.

## Round 1

What changed
- **Resources for GET reads.** `ApiService` now has `httpResource` factories (`leaguesResource`, `modelsResource`,
  `providersResource`, `apiLogEndpointsResource`, `matchResource`, `predictionResource`, `usersResource`,
  `promptsResource`, `dashboardResource`, `recentPredictionsResource`, `needsReviewResource`) and
  `modelOverviewResource` (rxResource over a forkJoin). They cancel a superseded request when a param changes, and
  stay idle (no request) while their `enabled`/params function returns `undefined`. The old observable twins were
  deleted.
- **`core/resource.ts`**: `viewState`, `errorMessage`, `safeValue` map a resource to the `loading | error | ready`
  state and API `message` the templates already use (templates unchanged). `safeValue` exists because `value()` throws
  in the error state.
- **`apiError`** unwraps an `HttpErrorResponse` wrapped as `Error.cause`.
- **`PagedList`** (matches, predictions, API logs) is now backed by `rxResource`: cancellation is automatic, the last
  good rows stay while the next page loads, nothing is fetched until the page calls `reload()` once.
- Pages moved off `subscribe` + manual loading flags: models, model-detail, match-detail, prediction-detail,
  dashboard (live updates use `resource.reload()`), settings (users), prompts (list; `selectedId` is a
  `linkedSignal`), filter bar (leagues/models lookups), api-logs, matches. `ngOnInit` removed where inputs were not
  needed; the `effect(() => this.load(id))` + unsubscribed `subscribe` pattern (a race on fast id changes) is gone.
- **Shareable filters.** New `shared/url-state.ts` (`fromQuery`, `toQuery`). Filter bar, matches and API logs read their
  filters from the query string on load and write them on Apply/Reset (merge, replace history entry; first load does not
  touch the address bar). Reports tab switch now merges query params so filters survive it.
- **Live stream** (`LiveService`): new `refresh` subject (new prediction or reconnect after a drop, so missed events are
  recovered); the retry wait ends early on the browser `online` event. Dashboard and predictions reload from it.
- **Router**: `withViewTransitions` (skipped for reduced motion, the first load and query-only changes). Shell title is
  a `toSignal` over `NavigationEnd` instead of a subscription.

Not done / decided against
- Cross-tab logout via `BroadcastChannel`: the session lives in `sessionStorage` (per tab by design), so there is
  nothing to sync.
- Reports page still uses its own `run()` with one shared state; its specs assert request cancellation. Next round.
- Online/offline banner and tab-hidden pause need template and CSS (UI lane).

How verified
- `npx ng test --watch=false`: all specs pass. New: `shared/paged-list.spec.ts`, `shared/url-state.spec.ts`,
  `shared/filter-bar.spec.ts`, resource specs in `core/core.spec.ts` (cancel on id change, API message on failure,
  idle when disabled).
- `npx ng build --output-path <scratchpad>/a4-dist`: succeeds.

## Round 2

What changed
- **Reports page on resources.** Each tab (models, history, markets, comparison, Monte Carlo) is an `rxResource` that
  runs only while its tab is active and the filter bar has reported, so the shared `run()` + `Subscription` plumbing is
  gone. Switching tab, filters, page, sort or "at least N models" cancels the superseded request. `state()`/`error()`
  come from the active resource (`statusToView`), so the templates are unchanged. History and Monte Carlo keep their last
  rows while the next page loads (`keepPrevious`) and drop them on error.
- **Tab from the URL.** `tab` is a routed input (`withComponentInputBinding`); `selectTab` only navigates, so links to
  `?tab=history`, Back and Forward work.
- **`<mm-model-breakdown>`** (in `pages/reports.ts`): the expanded model row owns its own `modelBreakdownResource`
  (new in `ApiService`), so closing the row or changing filters cancels the request. A failure shows the API message in
  the row instead of a toast plus a forced collapse. Trade-off: re-opening a row refetches (no per-model cache).
- **CSV/Excel export** uses `await firstValueFrom` instead of a nested subscribe.
- `core/resource.ts`: `statusToView`, `keepPrevious` (linkedSignal) added.
- **Live stream** closes while the tab is hidden and, on return, triggers `refresh` so pages reload; offline/online
  show a toast. **Auth** re-checks token expiry on `visibilitychange` (timers stall in a sleeping laptop).
- **Chart**: updates in place when only data/options change (no redraw flash); no draw-in animation under
  `prefers-reduced-motion`.
- **Signals for form state**: prompts (draft/new fields, `dirty` and `typeValid` are now `computed`), settings dialog
  (new user/reset), import (provider/version). Two-way `[(ngModel)]` binds to the signals directly.

Not done / decided against
- Signal Forms (`@angular/forms/signals`) for login/settings: the Angular 22.3 API still carries `@experimental` parts
  and the reactive forms there work; revisit when it is fully stable.
- Remaining `subscribe` calls are one-shot mutations in event handlers (save, settle, login); they complete and need no
  teardown. api-logs/matches filter fields stay plain properties (only ngModel listeners write them).
- BroadcastChannel: still no shared storage between tabs, nothing to sync.

How verified
- `npx ng test --watch=false`: 47/47. `review-fixes.spec.ts` now covers breakdown cancel + error, history rows dropped on
  a failed filter, last rows kept while a page loads and the stale request cancelled, only the active tab requested.
- `npx ng build --output-path <scratchpad>/a4-dist`: succeeds.

## Round 3

What changed
- **Matches and API logs filters are signals** (`search`, `league`, `status`, `from`, `to`, ...). The URL restore and
  `apply()` read them once; the status chips and Reset call `setStatus()`/`reset()` instead of assigning in the template.
- **Prompts page uses the in-app confirm dialog** (`ConfirmService`) instead of native `confirm()`. `ConfirmHost` was
  mounted but nothing called it. Select, Cancel and the `canDeactivate` guard are now async; `beforeunload` is unchanged.
- New specs: Matches restores filters and sort from the URL into the first request; Prompts keeps the draft when the
  discard dialog is declined and the leave guard resolves through the dialog.

Not done / decided against
- Remaining `subscribe` calls are one-shot mutations/on-demand reads in event handlers (no teardown needed).
- BroadcastChannel, Web Share, RelativeTimeFormat: the session lives in `sessionStorage` per tab and no page shows a
  relative time, so they would be for show.
- `FilterBar.ngOnInit` stays: it needs the `fields`/`initialDays` inputs to be set.

How verified
- `npx ng test --watch=false`: 52/52. `npx ng build --output-path <scratchpad>/a4-dist`: succeeds.

## Round 4

What changed
- Removed the last `$any()` casts in templates: Reports tab change and min-models select, Settings role select. Handlers
  now take the typed value/`Event` and narrow in TS (`selectTab` ignores values outside `TABS`).

Not done: nothing else worthwhile left in the TS lane (no NgModule, `*ngIf`, constructor injection or manual teardown remain).

How verified
- `npx ng test --watch=false`: 52/52. `npx ng build --output-path <scratchpad>/a4-dist`: succeeds.
