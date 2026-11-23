# MatchMind web — UI/UX review

Review date: 2026-11-23. Method: code read only (no running app), split across 5 reviewers.
Scope: color, layout, font, font-size, date picker, select, spinner/loading, glassmorphism, plus a11y/UX found along the way.
Paths are relative to `MatchMind/matchmind-web/`. Line numbers reflect the code at commit `0604c39`; re-check them before fixing.

Note: the app has **no custom date picker or custom select**. It uses native `<input type="date">`, `<select>`, `<datalist>` and `<details>` menus. The date-picker and select findings cover labels, width, clipping and behaviour around those native controls.

## Summary

186 findings: 5 High, 68 Med, 113 Low.

| Group | Screens | Count |
|---|---|---|
| Design system / shared | styles.scss, shared/*, shell, not-found | 27 |
| 1 | login, dashboard, api-logs, settings | 40 |
| 2 | matches, match-detail, import | 35 |
| 3 | predictions, prediction-detail, models, model-detail | 32 |
| 4 | prompts, providers, reports | 52 |

### High — fix first

- **DS-1**: the Sign out button has no accessible name on mobile.
- **DS-2**: in dark mode, `.btn-danger` has white text on `#fb7185`, about 2.6:1.
- **SET-1**: the role `<select>` acts on `(change)`, so arrow keys fire one confirm per keystroke.
- **PDET-1**: the expanded history row is `nowrap`, so long text scrolls the table sideways.
- **PROV-1**: Rotate key kills the active key at once, with no confirm.

### Cross-cutting fixes (one root fix closes many IDs)

| Theme | Root fix | Closes |
|---|---|---|
| Chart colors hard-coded, fail dark-mode contrast | Export a token-based `SERIES`/`RESULT_COLORS` from `shared/chart.ts`, refreshed in `applyTheme()` | DS-14, DS-3, DASH-1, DASH-2, MDL-2, REP-1, REP-2 |
| Success/WIN shown in two colours (indigo vs emerald) | Add `--mm-win-soft/-ink/-line` tokens and use them for `.tag-success`, `.alert-success` and diff-add | DS-13, PROMPT-11 |
| Three different loading patterns, and false "empty" text while loading | Use `mm-state` for first load and `.dt.loading` + `aria-busy` for reload; branch on `isLoading()` before `@empty` | DS-11, DS-12, PRED-1, LOGS-4, REP-8, MATCH-2, DASH-3, SET-3, PROV-4, MDET-1, MDL-1, MOD-1 |
| Buttons with no busy state (double submit) | Use the `[disabled]` + `pi-spinner pi-spin` pattern on every API action | MDET-3, LOGS-3, SET-2, SET-12, PROMPT-6/8/9, PROV-9/10, IMP-2/3 |
| `.dt td { white-space: nowrap }` breaks expanded rows | Add `.dt tr.expanded > td { white-space: normal }` in styles.scss | PDET-1, REP-5 |
| Tables not in `.table-wrap` / no `hide-sm` overflow at 375px | Wrap the table and add `compact-sm`/`hide-sm` | MDET-2, PDET-2, PDET-3, PROV-3, IMP-9, REP-6, MOD-2 |
| `details.menu` clipped by `.panel.flush { overflow:hidden }`, no Esc/outside-click close | Fix once in styles.scss plus a shared close handler | DS-7, PRED-5, REP-10 |
| Hand-rolled filter forms duplicate `mm-filter-bar` | Extend `FilterBar` (slots for chips/extra fields) | MATCH-1, LOGS-1, LOGS-8 |
| `.mt-2` utility missing | Add `.mt-2 { margin-top: var(--sp-2) }` | SET-8, PROV-14 |
| `<code>` uses the browser default monospace | Add a global `code { font-family: var(--mm-mono); font-size: .85em }` | LOGS-7, PROMPT-17, PROV-17 |
| Duplicated local CSS (`.pending-note`, `.kpi-sub`, `.count-note`, `.table-wrap.tall`, 16px inputs) | Move to styles.scss once on the `--fs-*` scale; delete the local copies | MATCH-5, MATCH-13, LOGS-6, LOGS-9, IMP-10, SET-10, REP-16, REP-17, DASH-8 |
| Meaning available only in `title` (hover-only) | Visible `.page-note`/`.cell-sub`, or `aria-describedby` | DS-24, DASH-5, MDET-9, PRED-6, MOD-5, MDL-7, REP-13, PROV-6, PROV-7, DS-8 |
| Glass surfaces over scrolling content, no fallback | Use `--mm-card-solid` for overlays and sticky `th`; add `@supports not (backdrop-filter)` and reduced-transparency coverage | DS-15, DS-16, DS-17 |
| Load errors with no Retry | Add a Retry button with `btn btn-outline btn-sm` and `reload()` | PDET-5, MDL-4, MATCH-3, REP-7, SET-4, PROV-5 |

## New work: custom date picker and custom select

These are not fixes. Today the app uses only native `<input type="date">` and `<select>`, so the popup (calendar, option list) follows the OS. It cannot be styled to match the glass theme or dark mode, and it looks different on Windows, macOS, Android and iOS.

Build both on the CDK the app already has: `@angular/cdk` 22.2.1, which includes `overlay`, `listbox` and `a11y`. Do not add a new dependency.

### CUSTOM-1: `<mm-select>` (shared/select.ts)

**API**
- Implements `ControlValueAccessor`, so it works with both `formControlName` (filter-bar) and `[(ngModel)]` (dialogs).
- Inputs:
  - `options: { value: string; label: string; disabled?: boolean }[]`
  - `placeholder`
  - `size: 'md' | 'sm'` (maps to `.input` / `.input-sm`)
  - `ariaLabel`
- Output: `(selectionChange)`. It fires only when the user picks an option, never while they move through the list with arrow keys. This fixes SET-1.
- `id` passthrough, so an existing `<label for>` keeps working.

**Behaviour**
- Trigger: a `<button>` with `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded` and `aria-controls`.
  - It shows the selected label with ellipsis.
  - The full label goes in `title` and also in an `sr-only` text.
- Popup:
  - Use `cdkConnectedOverlay` so it renders in the top layer. It is then never clipped by `.panel.flush` (DS-7).
  - Use `cdkListbox` + `cdkOption` for keyboard support: Up/Down, Home/End, type-ahead, Enter/Space to select, Esc to close and return focus to the trigger.
- Position:
  - Below the trigger, and flipped above it when there is no room.
  - At least as wide as the trigger. It may grow up to `min(24rem, 100vw - 32px)` so long options are not cut (DS-8).
- Size: `max-height: 320px` with scrolling, and the active option scrolled into view.
- Closes on outside click, Esc and Tab.
- States: disabled, `aria-invalid` (red border), and `loading` (spinner option) for async lists such as MDL-3.
  - Empty state: when there are no options, show a disabled row with a message, for example "No prompt contains {{EXTERNAL_API_KEY}}" (PROV-11).

**Style**
- Trigger: the same box as `.input` (height, radius, `--mm-input-line`, focus ring per DS-10), with a `pi-chevron-down` icon that rotates when open.
- Popup:
  - `--mm-card-solid` background, not translucent `--mm-card`, because it sits over content (DS-16).
  - `--mm-line-2` border, `--mm-radius`, `--mm-shadow-lg`.
  - Option text at `--fs-sm`.
- Option states:
  - Hover/active: `--mm-surface-2`.
  - Selected: `--mm-green-soft` + `--mm-green-ink`, with a check icon.
  - Disabled: `--mm-ink-3`.
- Dark mode: tokens only, no hex.
- Motion: fade/scale in about 120ms with `--mm-ease`, turned off under `prefers-reduced-motion`.
- Touch (`pointer: coarse`): option rows at least 44px tall. Below 640px the popup may become a bottom sheet (full width, anchored to the bottom).

**Replace these usages (17)**

| File:line | Notes |
|---|---|
| src/app/shared/filter-bar.ts:91, 97, 102, 108, 114, 120 | `formControlName`. Move the `title` explanation into option descriptions or hint text (DS-8). |
| src/app/shared/kit.ts:226 | Paginator "Rows per page". Keep the existing note at :239 about change-event bubbling; the custom output avoids that problem. |
| src/app/pages/api-logs.ts:29, 33, 37 | `[(ngModel)]` |
| src/app/pages/settings.ts:94, 107, 153 | :107 is the role select (SET-1). Commit only on pick, then confirm. Rename "All" to "All statuses" (SET-15). |
| src/app/pages/match-detail.ts:208 | Dialog, `autofocus` |
| src/app/pages/prediction-detail.ts:250 | Dialog, `required`, `autofocus` |
| src/app/pages/model-detail.ts:99 | Merge target. Use the loading and empty states (MDL-3), full width (MDL-5). |
| src/app/pages/prompts.ts:85 | Add a visible "Copy for:" label (PROMPT-14). |
| src/app/pages/providers.ts:108 | Empty state (PROV-11) |
| src/app/pages/reports.ts:309 | Min models |

### CUSTOM-2: `<mm-date-input>` and `<mm-date-range>` (shared/date-picker.ts)

**API**
- Both components implement `ControlValueAccessor`.
- The value stays a `YYYY-MM-DD` string, the same as the native input today. `localDay()`/`dayRange()` in filter-bar.ts and all URL state then stay unchanged.
- Inputs: `min`, `max`, `ariaLabel`, `placeholder`.
- `mm-date-range` wraps two `mm-date-input`s that share one popup. It validates From ≤ To and sets `aria-invalid` + `aria-describedby` on error (DS-9, MATCH-12).
- Visible labels: the range shows a "From" / "To" prefix, or a `label` input such as "Kick-off" or "Received" (DS-9, LOGS-8).

**Behaviour**
- Typing:
  - The field stays a text input, so keyboard users can type a date.
  - Display format follows `format.ts`, for example `dd/MM/yyyy`.
  - Typed text is parsed on blur. Invalid text shows `aria-invalid` plus an error.
- Calendar button:
  - A `pi-calendar` icon button opens the popup.
  - The popup is a `cdkConnectedOverlay` with `role="dialog"` and an `aria-label`.
  - Focus is trapped inside it (`cdkTrapFocus`) and returns to the trigger on close.
- Calendar grid:
  - `role="grid"` with weekday headers.
  - Arrow keys move by day/week, PageUp/PageDown by month, Shift+PageUp/PageDown by year, Home/End to the start or end of the week.
  - Enter selects, Esc closes.
- Header: previous/next month buttons, a month/year label (click to switch to a month or year view), and a **Today** button.
- Range mode:
  - The first click sets From and the second sets To.
  - Days in between get a highlight band.
  - Hovering previews the range.
- Presets (range only): Today, Last 7 days, Last 30 days, This month.
- Clear: an × button on each input, which matters because reset currently relies on the bar's Reset button.
- Timezone: work only in local calendar days. Never convert through `Date.toISOString()`, because that shifts the day in UTC+7.
- Week start: Monday.

**Style**
- Input: the same box as `.input`, focus ring per DS-10, calendar icon on the right.
- Popup: `--mm-card-solid`, `--mm-line-2` border, `--mm-radius`, `--mm-shadow-lg`, and no blur (DS-15/16).
- Day cells:
  - At least 36px (44px on `pointer: coarse`), numbers in tabular-nums.
  - Today: ring in `--mm-green`.
  - Selected: `--mm-green` background with white text (keep 4.5:1 in dark mode, see DS-3).
  - In-range: `--mm-green-soft`.
  - Outside the month or disabled: `--mm-ink-3`.
- Below 640px: the popup becomes a full-width bottom sheet. Range mode shows one month.
- Reduced motion: no slide animation.

**Replace these usages (6 inputs, 3 ranges)**

| File:line | Notes |
|---|---|
| src/app/shared/filter-bar.ts:81, 83 | `formControlName` from/to becomes one `mm-date-range`. The From > To error at :125 moves into the component. |
| src/app/pages/matches.ts:82, 84 | `[(ngModel)]` with `dateError()`. Remove the local validation once the component handles it (MATCH-12). |
| src/app/pages/api-logs.ts:25, 27 | Add the visible "Received" label (LOGS-8), or switch to `mm-filter-bar` (LOGS-1). |

### Order and verification

1. Build `mm-select`. Migrate `filter-bar.ts` first, because it is used on the most screens, then `settings.ts:107` (closes SET-1), then the rest.
2. Build `mm-date-input` and `mm-date-range`. Migrate `filter-bar.ts`, then `matches.ts` and `api-logs.ts`.
3. Write focused vitest specs for each component:
   - Keyboard navigation.
   - The CVA write/read round-trip of the `YYYY-MM-DD` string.
   - From > To validation.
   - `selectionChange` not firing on arrow keys.
4. Update the existing Playwright e2e selectors that target native `select`/`input[type=date]`. `selectOption()` no longer works on the custom control, so the tests must click the trigger and then the option.
5. Check by eye in light and dark mode, at 375px and on desktop, with only the keyboard, and with a screen reader on the trigger and popup.

Out of scope: the `<datalist>` league and provider autocompletes (filter-bar.ts:88, matches.ts:87/183, import.ts:194/200). They can move to a `mm-combobox` later, reusing the `mm-select` overlay and listbox.

## Design system / shared

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| DS-1 | High | a11y | src/app/layout/shell.ts:66 + src/styles.scss:196 | At ≤900px `.topbar-right .label {display:none}` removes the only text of the Sign out button. The `<i>` has no aria-label, so the button has no accessible name on mobile. | Add `aria-label="Sign out"` on the button and `aria-hidden="true"` on the icon, or hide the label with `.sr-only`. |
| DS-2 | High | color | src/styles.scss:399 (dark tokens at :77) | In dark mode `--mm-loss` becomes `#fb7185`. `.btn-danger` puts white text on it, about 2.6:1, which fails AA. Used by confirm/reason dialogs (kit.ts:164, ui.ts:136). | Use a dark-mode `.btn-danger` background of `#be123c` (or a new `--mm-danger-bg` token) and keep white text. |
| DS-3 | Med | color | src/styles.scss:10 (not remapped in :66-88) | `--mm-green` `#4f46e5` stays the same in dark mode. On `#0a0d1f`/`#161b3a` it is about 2.4:1, below the 3:1 UI minimum. Affected: `.kpi > i` icon (:247), `.tab.active` underline (:512), `.prompt-item.active` border (:587), `.input:focus` border (:417). | Remap `--mm-green` (or add `--mm-accent-ui`) to `#818cf8` in the dark block for borders and icons. |
| DS-4 | Med | layout | src/app/layout/shell.ts:39,47,86 + styles.scss:191 | `collapsed` comes from localStorage and also applies on mobile. A user who collapsed the sidebar on desktop gets a 232px drawer with icons only: no brand text, no labels. The collapse button is hidden on mobile, so it cannot be undone there. | Use `collapsed() && !isMobile` for label rendering, or ignore `nav-collapsed` under 900px. |
| DS-5 | Med | layout | src/app/layout/shell.ts:65, styles.scss:173-175,196 | At 375px the topbar holds the menu button, the title (`--fs-xl`, 24px), the tz chip, the avatar plus the full username (not hidden, no max-width) and Sign out. `.page-title` has min-width 0, so it shrinks to "…" first. A long username can push the bar past the viewport. | Hide the username text or the tz chip at ≤640px, and give `.user-chip` `max-width` + ellipsis. |
| DS-6 | Med | layout | src/app/layout/not-found.ts:14 | `<code>{{ url }}</code>` holds an unbroken URL inside a flex `.state-box` with no `overflow-wrap`. A long or mistyped URL overflows horizontally at phone width. | Add `overflow-wrap:anywhere` (e.g. on `.state-box`, styles.scss:334). |
| DS-7 | Med | select | src/styles.scss:521 with .panel.flush :215 | `details.menu .menu-body` is absolutely positioned (max-height 360px). It is used inside `.panel.flush` (predictions.ts:42, reports.ts:182), which has `overflow:hidden`. With a short or empty table the menu is clipped. It also has no Esc or outside-click close. | Move `overflow:hidden` off `.panel.flush` (clip only `.table-wrap` radius), or render the menu as a popover/top layer. |
| DS-8 | Med | select | src/app/shared/filter-bar.ts:114-123, styles.scss:351,355 | Native selects use `.f-select-sm` (145px, about 9.25rem in the grid). Option text like "Count: latest per moment" or "Any top-pick result" is truncated. The explanation sits only in `title`, which is hover-only and not available on touch or to keyboard users. | Shorten option labels or let these fields span 2 columns; move the explanation into visible helper text or an `aria-describedby` hint. |
| DS-9 | Med | date-picker | src/app/shared/filter-bar.ts:80-84,125 | Native `type=date` with `aria-label` only, so there is no visible "From"/"To" label (WCAG 3.3.2). When From > To, the error span is not linked by `aria-describedby`, and the inputs never get `aria-invalid`, so the `.input[aria-invalid]` style (styles.scss:419) never shows. | Add visible small labels (or `<label class="sr-only">` plus a visible "From/To" prefix), and bind `aria-invalid` and `aria-describedby` to the error id. |
| DS-10 | Med | a11y | src/styles.scss:417, :56 | `.input:focus` sets `outline:none`. The only indicators are a 1px border colour change and a 30%-alpha halo (about 1.5:1 against white). That is weak for WCAG 2.4.11/1.4.11, and Windows forced-colors mode drops box-shadow, leaving no indicator. | Use `outline: 2px solid var(--mm-green); outline-offset: 1px` on `:focus-visible` (keep the halo as extra). |
| DS-11 | Med | spinner | src/app/shared/ui.ts:86 | The skeleton container has `aria-label="Loading"` on a role-less div. A label on a generic element is ignored, so screen readers hear nothing, and nothing announces when loading finishes. | Add `role="status"` and a `.sr-only` "Loading…" text (drop the aria-label). |
| DS-12 | Med | spinner | ui.ts:86 vs pages (e.g. matches.ts:156), styles.scss:473,435 | There are three loading patterns: the `mm-state` skeleton, an ad-hoc `.empty-state` + `pi-spinner` "Loading…", and `.dt.loading` at 50% opacity with no `aria-busy`. Global reduced-motion (:600) also freezes `.pi-spin`, leaving a static icon with no other cue. | Standardise on `mm-state` for first load and `.dt.loading` + `aria-busy` for reloads; keep the "Loading…" text next to every spinner. |
| DS-13 | Med | color | src/styles.scss:441,434 vs :22,128; format.ts:75 | Semantic "success" maps to the indigo primary (`--mm-green-soft`/`--mm-green-ink`), so WIN tags and `.alert-success` are indigo. Meanwhile `.win` text, `.fchip[WIN]` and the charts use emerald. The same outcome gets two colours, and there is no `--mm-win-soft` token. | Add `--mm-win-soft`/`--mm-win-ink`/`--mm-win-line` (light and dark) and point `.tag-success`/`.alert-success` at them. |
| DS-14 | Med | color | src/app/shared/chart.ts:14-33 (pages: dashboard.ts:18,243; reports.ts:543-546) | `chart.ts` themes only text, grid and arc borders. It exports no series or result palette, so pages hard-code hex values that drift from the tokens: `#059669`/`#e11d48`/`#c98a00` against `--mm-win #047857`/`--mm-loss`. They do not change in dark mode. The tooltip bg `rgba(30,27,75,.92)` is the same in both modes, with no border, so in dark it blends into `#161b3a` cards. | Export `SERIES`/`RESULT_COLORS` from `chart.ts`, built from `token('--mm-win')` etc. and refreshed in `applyTheme()`; give the tooltip a `--mm-line-2` border in dark. |
| DS-15 | Med | glass | src/styles.scss:455 | Every sticky `thead th` cell has its own `backdrop-filter` (one blur layer per header cell, nested inside an already blurred `.panel`). This is costly to paint while scrolling wide tables, and nested backdrop roots only sample the panel. | Drop the blur on `th` and use an opaque `--mm-card-solid`-based header bg (it is sticky, which is what the `--mm-card-solid` comment at :16 prescribes). |
| DS-16 | Med | glass | src/styles.scss:170-171, :537-538, :521-522 | Topbar, toasts and the column menu sit over scrolling content but use translucent `--mm-card` (.62 light / .55 dark). There is no `@supports not (backdrop-filter…)` fallback, so where blur is unavailable or disabled, the text behind shows through at 38–45%. | Use `--mm-card-solid` for overlays (toast, menu), or add `@supports not (backdrop-filter: blur(1px)) { :root { --mm-card: var(--mm-card-solid) } }`. |
| DS-17 | Low | glass | src/styles.scss:92-94 vs :137,193,527,38 | The `prefers-reduced-transparency` override skips several surfaces. The sidebar bg `rgba(30,27,75,.78)`, scrim `blur(4px)`, `dialog::backdrop blur(8px)` and `--mm-surface-2` (.88) are hard-coded or not remapped, so they stay translucent or blurred. | Tokenise sidebar/scrim/backdrop colours and blur, and solidify them in the reduced-transparency block. |
| DS-18 | Low | font | src/styles.scss:178; public/fonts/fonts.css | `.user-chip .avatar` uses `font-weight:700`, but IBM Plex Sans is loaded only as 400–600, so the browser synthesises a faux bold. Barlow Semi Condensed (500/600/700 faces) is declared but never referenced (`--mm-display` = Plex). | Use 600, and delete the unused Barlow `@font-face` blocks. |
| DS-19 | Low | font-size | src/styles.scss:150, :331 | Some text is below 12px or set in fixed px: `.brand-text small` .72rem (11.5px) and `.json` 12px. The type scale `--fs-*` is bypassed by many one-off sizes (.8, .82, .85, .875, .9, .95rem; 13px at :593-594), and the body is a fixed `15px` (:100), which ignores the user's default font size. | Snap to `--fs-xs/sm/md/lg/xl` (min `--fs-xs`), and set the body to `var(--fs-md)`. |
| DS-20 | Low | layout | src/styles.scss:62 | The spacing scale `--sp-1…--sp-5` is defined but used 0 times. All gaps and paddings are ad-hoc (.3, .35, .4, .45, .55, .65, .85, 1.1rem…). | Use `--sp-*` in new or fixed rules, and gradually replace near-values (.45→`--sp-2`, .85→`--sp-4`). |
| DS-21 | Low | layout | src/styles.scss:135,139 | `.shell min-height:100vh` and the sidebar `height:100vh`. On mobile browsers, 100vh includes the URL bar, so the bottom of the drawer or nav is cut off. | Use `100dvh`, with `100vh` as a fallback. |
| DS-22 | Low | color | src/styles.scss:505-506 | The tab scroll-shadow gradients are hard-coded `rgba(30,27,75,.2)` and are invisible on the dark surface, so in dark mode hidden tabs have no cue. | Use a token (e.g. `--mm-line-2`) for the shadow colour. |
| DS-23 | Low | a11y | src/app/shared/kit.ts:68-71 | The toast container has `aria-live="polite"`, and each toast also has `role=status`/`alert`. Nested live regions can announce twice. | Remove `aria-live` from `.toasts` and keep the per-toast roles. |
| DS-24 | Low | a11y | src/app/shared/ui.ts:42; shell.ts:64 | Key explanations exist only in `title`: the small-sample warning, and the tz chip with `cursor:help`, which is not focusable. Touch and keyboard users never see them. | Put the text in a `.sr-only` span or `aria-describedby`, or show it on focus/tap. |
| DS-25 | Low | a11y | src/app/shared/ui.ts:92,97 | The decorative state icons (`pi-exclamation-circle`, `pi-inbox`) lack `aria-hidden="true"` (not-found.ts does have it). | Add `aria-hidden="true"`. |
| DS-26 | Low | color | src/styles.scss:397-398,400 | The primary and danger button colours are hard-coded (`#4f46e5→#7c3aed`, `#4338ca→#6d28d9`, `#9f1239`) instead of tokens, so theme changes miss them. | Use `var(--mm-green)`/`var(--mm-green-2)`/`var(--mm-loss-ink)` (or new gradient tokens). |
| DS-27 | Low | other | src/index.html:3-8 | There is no `<meta name="color-scheme" content="light dark">` or `theme-color`. Dark-mode users see a white flash until the CSS loads. | Add `<meta name="color-scheme" content="light dark">` (and a `theme-color` meta pair). |

### Tokens and patterns to reuse when fixing

- **Colour tokens:**
  - `--mm-ink`, `--mm-ink-2`, `--mm-ink-3` for text.
  - `--mm-line`, `--mm-line-2`, `--mm-input-line` for borders.
  - `--mm-card` (glass), or `--mm-card-solid` for anything content scrolls under.
  - `--mm-surface-2`, `--mm-surface-3` for fills.
- **Semantic colour:**
  - Tokens: `--mm-win`, `--mm-loss`, `--mm-pending`, and the `--mm-{green,loss,warn,blue}-{soft,ink,line}` sets.
  - Classes: `.win`, `.loss`, `.tag-{success,danger,warn,info,secondary}`, `.alert-{warn,error,info,success}`.
- **Type and space:**
  - Scales: `--fs-xs/sm/md/lg/xl` and `--sp-1…5`.
  - Shape and motion: `--mm-radius`, `--mm-shadow`, `--mm-focus`, `--mm-t`, `--mm-ease`.
  - Fonts: `--mm-font`, `--mm-mono`.
  - Use `.num` for figures (tabular, right-aligned).
- **Layout:** `.stack`, `.row`, `.grid-2/3`, `.dash-grid` + `.span-*`, `.kpis` + `.kpi`, `.panel` (`.flush`, `> header`), `.hero`, `.facts`, `.dl`.
- **Controls:**
  - Buttons: `.btn` + `-primary`, `-danger`, `-text`, `-outline`, `-sm`, `-icon`.
  - Inputs: `.input` (`.input-sm`, `.f-search`, `.f-select`, `.f-select-sm`, `.date-range`).
  - Chips and fields: `.chips`/`.chip[aria-pressed]`, `.field` + `.field-error`, `.check`.
- **Tables:**
  - Containers: `.table-wrap` (`.tall`/`.short`) + `table.dt`.
  - Headers: `th[mmSort]`, `th[mmResize]`.
  - Paging: `mm-paginator`, `PagedList<T>`.
  - Cell and column helpers: `.sticky-end`, `.hide-sm`/`.show-sm`, `.cell-sub`, `.truncate`/`.clamp`, `.empty-state`.
- **States:** `<mm-state>` (loading, error or empty), `.skeleton`, `.pi-spinner.pi-spin`, `ToastService.add()`, `CopyService.copy()`.
- **Overlays and widgets:**
  - Dialogs: `<mm-dialog>` (`busy`), `ConfirmService.ask()`, `<mm-reason-dialog>`.
  - Navigation and filters: `<mm-tabs>`, `<mm-filter-bar>`.
  - Display: `<mm-chart>`, `<mm-score>`, `<mm-result>`, `<mm-small-sample>`, `<mm-json>`.


## Login / Dashboard / API logs / Settings

### login

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| LOGIN-1 | Med | ux | src/app/pages/login.ts:63-64, 31, 43 | `Validators.maxLength(64/72)` errors fall through to the "required" text. A username over 64 characters shows "Enter your username.", and a password over 72 shows "Enter your password." | Branch on `hasError('maxlength')` and say "64 characters max" / "72 characters max", or add a native `maxlength` attribute to the inputs. |
| LOGIN-2 | Med | a11y | src/app/pages/login.ts:30-31, 36-43 | The `.field-error` divs are not tied to their inputs (no `aria-describedby`), and focus stays on the submit button when validation fails, so screen readers don't hear the errors. | Give each error an id, point `aria-describedby` at it, and focus the first invalid control in `submit()`. |
| LOGIN-3 | Low | a11y | src/app/pages/login.ts:16 (+ styles.scss:581 hides `.login-art`) | The page's only `h1` sits in `.login-art`, which is `display:none` at 860px and below. On phones the page has no h1; "Sign in" is an h2. | Make "Sign in" the h1 and turn the art headline into a `p`/`div`. |
| LOGIN-4 | Low | a11y | src/app/pages/login.ts:14 | The brand mark "M" in the art panel is not `aria-hidden` (the mobile copy at :23 is), so screen readers announce "M MatchMind". | Add `aria-hidden="true"` to `.brand-mark` at :14. |
| LOGIN-5 | Low | layout | src/app/pages/login.ts:19 | An empty `<span></span>` exists only to make `justify-content: space-between` work. | Remove it and use `justify-content: center` with a gap, or a margin on the headline block. |
| LOGIN-6 | Low | a11y | src/app/pages/login.ts:38-39 | The password toggle sets `aria-pressed` and also swaps its `aria-label` (Show/Hide), so screen readers hear a contradictory state. | Keep a fixed `aria-label="Show password"` with `aria-pressed`, or drop `aria-pressed` and keep the label swap. |
| LOGIN-7 | Low | ux | src/app/pages/login.ts:30 | No initial focus on the username field of a single-purpose sign-in page. | Add `autofocus` to `#username`. |

### dashboard

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| DASH-1 | Med | color | src/app/pages/dashboard.ts:243, 275 | Win-rate line and model bars use hard-coded `#4f46e5`. In dark mode on `--mm-card-solid` #161b3a this is about 2.1:1, below the 3:1 non-text minimum (WCAG 1.4.11). | Read colors via the chart.ts `token()` helper: `--mm-green` in light, `--mm-lime` in dark. |
| DASH-2 | Med | color | src/app/pages/dashboard.ts:15-18 | `RESULT_COLORS`/`SERIES` are raw hex that bypass tokens and don't match the "same hues" comment: WIN `#059669` vs `--mm-win` #047857, LOSS `#e11d48` vs `--mm-loss` #be123c. HALF_WIN `#6ee7b7` and VOID `#c3cad5` doughnut slices are under 3:1 on white. | Map from `--mm-win`/`--mm-loss`/`--mm-pending`/`--mm-ink-3`. Use darker tints for the half/void slices, or add a pattern. |
| DASH-3 | Med | spinner | src/app/pages/dashboard.ts:176, 196 | `recent()` is `[]` while `recentPage` is loading, so the table briefly shows "No predictions in this range." and the form guide (:90) disappears. False empty state plus layout shift. | Gate on `recentPage.isLoading()` and show `<mm-state state="loading" [rows]="3">` or `.dt.loading` instead of `@empty`. |
| DASH-4 | Med | layout | src/app/pages/dashboard.ts:25-28, 145, 150 | `MODEL_TICKS` turns `autoSkip` off with labels up to 18 characters in `span-2` panels at a fixed 280px height (`.chart-box`). With many models the labels overlap. At 375px the label column takes about half the plot width. | Make the chart height depend on row count (for example `rows*22px`, minimum 280), or cap labels shorter on narrow screens. |
| DASH-5 | Med | a11y | src/app/pages/dashboard.ts:122, 124 | The Units/ROI definition (`roiDef`) is only in a `title` tooltip on a non-focusable `div`, so keyboard and touch users can't reach it. | Show the definition as visible `.kpi-sub` text, or add an info button with `aria-describedby`. |
| DASH-6 | Low | ux | src/app/pages/dashboard.ts:114-125 | Four KPIs are links with a hover border, and Units/ROI are plain `div.kpi` with the same styling. The affordance is inconsistent, and users will try clicking Units/ROI. | Link Units/ROI to `/reports` so every KPI is a link. |
| DASH-7 | Low | layout | src/app/pages/dashboard.ts:122-124 (+ `.kpi strong` nowrap) | At 375px `.kpis` gives 2 columns of about 170px. Units values like `+1234.56` at 1.6rem nowrap plus a 2rem icon can overflow the tile. | Allow `.kpi strong` to shrink (for example `font-size: clamp(...)`), or let the icon drop below 400px. |
| DASH-8 | Low | layout | src/app/pages/dashboard.ts:128 | `.count-note` is not defined anywhere (it is used differently in reports.ts:146), and `muted-text` sets `margin:0`, so the note sits right under the KPIs with only the stack gap. | Use the existing `.page-note` class. |
| DASH-9 | Low | ux | src/app/pages/dashboard.ts:91 | The hero label is a long sentence ("last N settled of the latest M predictions, newest on the right") in the hero's highest-weight slot. It wraps to 3+ lines on phones. | Shorten to "Recent form (newest right)" and move the counts into a `title` or `.hero-note`. |

### api-logs

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| LOGS-1 | Med | ux | src/app/pages/api-logs.ts:21-45 | Hand-rolled `.filter-bar` form duplicates `mm-filter-bar`. It lacks the collapse toggle (always expanded on phones, pushing the table below the fold), the Reset button, and the active-count badge. | Add the missing fields (search placeholder, provider/endpoint/status) to `FilterBar`, or at least copy its `filter-toggle` and Reset. |
| LOGS-2 | Med | a11y | src/app/pages/api-logs.ts:57 | A clickable `<tr tabindex="0">` opens a dialog with no role or accessible name and handles only Enter (not Space). Screen readers announce plain cells with no hint of an action. | Put a `<button class="btn-text">` (or link) in the Received cell that calls `open(l)`, and make the row click a mouse shortcut with `tabindex="-1"` like the dashboard tables. |
| LOGS-3 | Med | spinner | src/app/pages/api-logs.ts:161-162 | `open()` shows no loading feedback while it fetches detail, and repeat clicks or Enter fire parallel requests. | Track an `opening` id signal and show `pi-spinner pi-spin` in the row, ignoring clicks while it is set. |
| LOGS-4 | Low | spinner | src/app/pages/api-logs.ts:64 | The first load shows plain "Loading…" text in a table cell, while other pages use the `mm-state` skeleton. | Use `<mm-state state="loading" [rows]="6">` (or `.skeleton` rows) in the empty row. |
| LOGS-5 | Low | layout | src/app/pages/api-logs.ts:69 | The no-results message is bare text, unlike the error branch (:66) and dashboard empties that use `.empty-state` with an icon. | Wrap it in `<div class="empty-state"><i class="pi pi-filter-slash"></i><span>…</span></div>`. |
| LOGS-6 | Low | font-size | src/app/pages/api-logs.ts:100 | `.pending-note` is copied from filter-bar.ts:134 with an off-scale `.8rem`. | Move it to styles.scss once, with `font-size: var(--fs-sm)`. |
| LOGS-7 | Low | font | src/app/pages/api-logs.ts:58, 85, 87 | `<code>` gets no style here, so it falls back to the browser monospace (Courier) at the UA-shrunk size instead of `--mm-mono`. | Add a global `code { font-family: var(--mm-mono); font-size: .85em; }`, or reuse the `.page-note code` rule. |
| LOGS-8 | Low | date-picker | src/app/pages/api-logs.ts:24-28 | The date-range markup is a copy of filter-bar's native pair. It has `aria-label` only (no visible "Received" label), so users can't tell the range filters receive time. | Reuse `FilterBar` (LOGS-1), or add a visible `<span class="fact-label">Received</span>` before the range. |
| LOGS-9 | Low | layout | src/app/pages/api-logs.ts:101 | The `@media (max-height:500px) .table-wrap.tall` rule repeats styles.scss:205. | Delete it. |

### settings

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| SET-1 | High | select | src/app/pages/settings.ts:107, 272-282 | The role `<select>` acts on `(change)`. On Windows/Chrome, arrow keys on a focused closed select fire `change` each press, so keyboard users get a confirm dialog per keystroke and can't move past an option. | Use `(blur)`/explicit Save, or open a small "Change role" dialog (`mm-dialog`) from a button instead of an inline select. |
| SET-2 | Med | spinner | src/app/pages/settings.ts:116-118, 285-301 | Unlock, Enable and the role update have no in-flight state. Buttons stay enabled with no spinner, so double clicks send duplicate PATCHes and audit rows. | Keep a `pendingId` signal, disable that row's actions, and show `pi-spinner pi-spin` while it runs. |
| SET-3 | Med | spinner | src/app/pages/settings.ts:104-122, 132-136 | No loading state for the users or audit tables. While loading they show "No user matches these filters." and "No account changes yet." | Gate on `usersRes.isLoading()` / `audit() === null` and show `<mm-state state="loading" [rows]="4">` or `.dt.loading`. |
| SET-4 | Med | ux | src/app/pages/settings.ts:246 | Audit load errors are swallowed (`error: () => undefined`), so a failed load looks like "No account changes yet." | Store the error and render `mm-state state="error"` or a toast with Retry, as api-logs.ts:66 does. |
| SET-5 | Med | ux | src/app/pages/settings.ts:61, 52-58 | Submit is disabled while `pw.invalid`, but only the mismatch error is ever shown. Too short, too long or empty fields give no message, so the button just stays dead. | Keep the button enabled. On submit, `markAllAsTouched()` and show per-field `.field-error` (minlength/maxlength/required). |
| SET-6 | Med | a11y | src/app/pages/settings.ts:57-59 | The mismatch error isn't linked to `#confirm` (no `aria-describedby`/`aria-invalid`), and no input sets `aria-invalid`. | Add `[attr.aria-invalid]` and `aria-describedby` pointing at the error id. |
| SET-7 | Med | a11y | src/app/pages/settings.ts:116-118 | Row action buttons read "Unlock", "Disable" and "Reset password" with no user name, so screen-reader button lists are ambiguous. | Add `[attr.aria-label]="'Disable ' + u.username"` (and the same for each action). |
| SET-8 | Low | layout | src/app/pages/settings.ts:42, 73, 84 | `.mt-2` is not defined anywhere (styles.scss has only `.mb-2`), so the button row, endpoint list and footnote sit flush against the previous block. | Add `.mt-2 { margin-top: var(--sp-2); }` to styles.scss, or use `.stack` on the panel body. |
| SET-9 | Low | color | src/app/pages/settings.ts:183 | The sticky actions column re-implements `.dt .sticky-end` with a hard-coded `rgba(30,27,75,.25)` shadow that is wrong in dark mode. Its higher specificity also blocks the `--mm-row-hover` highlight on that cell. | Use the existing `class="sticky-end"` on th/td and drop the local rule. |
| SET-10 | Low | font-size | src/app/pages/settings.ts:186-187 | Ad-hoc `min-height: 40px` and `font-size: 16px` repeat the global `pointer:coarse` (styles.scss:627) and ≤640px 1rem (:643) rules. | Delete both. |
| SET-11 | Low | ux | src/app/pages/settings.ts:156-162 | The password show/hide button sits beside the input (`.pass-row`), while login uses the in-field `.password-wrap`. Same control, two patterns. | Reuse `.password-wrap` from login. |
| SET-12 | Low | spinner | src/app/pages/settings.ts:164 | The Generate button is disabled while `generating()` but shows no spinner. | Add `@if (generating()) { <i class="pi pi-spinner pi-spin"> }`. |
| SET-13 | Low | layout | src/app/pages/settings.ts:122, 136 | Empty rows use `muted-text` in a plain `td`, not `td.empty` + `.empty-state` as on other tables. They inherit `nowrap` and miss the empty-state padding and icon. | Use `<td class="empty"><div class="empty-state">…</div></td>`. |
| SET-14 | Low | a11y | src/app/pages/settings.ts:101, 129 | The Users and Account changes tables have no `aria-label`, unlike the dashboard and api-logs tables. | Add `aria-label="Users"` / `aria-label="Account changes"`. |
| SET-15 | Low | select | src/app/pages/settings.ts:94-95 | The status filter's first option is just "All" (meaning depends on the `aria-label`), while other selects say "All providers" / "Any outcome". | Rename it to "All statuses". |

## Matches / Match detail / Import

### matches

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| MATCH-1 | Med | layout | src/app/pages/matches.ts:78-104 | The filter form is hand-built and does not use `mm-filter-bar`, so it has no collapse toggle. On a 375px phone the search, two dates, league, checkbox, Apply/Reset and 7+ status chips all stack above the table. The shared bar starts collapsed under 760px for this reason (filter-bar.ts:150). | Reuse `mm-filter-bar` with an extra slot for the chips and archived toggle, or copy its `.filter-toggle` and `collapsed` signal. |
| MATCH-2 | Med | spinner | src/app/pages/matches.ts:47, :71 | The Suggested merges and League aliases tables show plain "Loading…" text in the cell. The main table shows an `.empty-state` with `pi-spinner pi-spin` (line 156). | Use the same `.empty-state` spinner block, or `mm-state state="loading"`, in both tables. |
| MATCH-3 | Low | ux | src/app/pages/matches.ts:46, :70 | The suggestions and aliases errors show only the text. There is no Retry, but the main table has one (line 159). | Add the same `btn btn-outline btn-sm` Retry that calls `suggestionsResource.reload()` / `aliasesResource.reload()`. |
| MATCH-4 | Low | color | src/app/pages/matches.ts:66, :150-151 | The Remove and Archive buttons are destructive (the dialog opens with `danger: true`), but they render as plain `btn-text` in link indigo. | Use `btn btn-text btn-sm danger` (styles.scss:404) for Remove and for Archive (keep the plain style for Unarchive). |
| MATCH-5 | Low | font-size | src/app/pages/matches.ts:188 | `.pending-note` repeats filter-bar.ts:134 and uses `.8rem`, which is not on the scale. | Move it to styles.scss once and use `font-size: var(--fs-xs)` or `var(--fs-sm)`. |
| MATCH-6 | Low | layout | src/app/pages/matches.ts:142 | The Corners column is plain text `{{ a ?? '—' }} : {{ b }}`. Score and HT in the same row use `mm-score`, so the alignment and font differ. | Use `<mm-score [home]="m.finalHomeCorners" [away]="m.finalAwayCorners" [muted]="true" />`. |
| MATCH-7 | Low | layout | src/app/pages/matches.ts:27, :56 | The panel header description is a full-size `muted-text` span placed between the h2 and the button. On narrow screens it wraps as a separate flex item. match-detail uses `<p class="muted-text sub">` under the title for this. | Wrap the h2 and the description in a `<div>` and use `<p class="muted-text sub">` (gets `--fs-sm`). |
| MATCH-8 | Low | a11y | src/app/pages/matches.ts:24 | `role="tabpanel"` is always set, but non-admins get no `mm-tabs`. The result is an orphan tabpanel with no tablist. | Bind it: `[attr.role]="auth.isAdmin() ? 'tabpanel' : null"`. |
| MATCH-9 | Low | a11y | src/app/pages/matches.ts:106 | The selection bar is a `role="status"` live region that contains buttons. Every toggle re-announces the whole bar, Merge/Clear labels included. | Put `role="status"` only on the "N selected" span. |
| MATCH-10 | Low | ux | src/app/pages/matches.ts:108, :111 | Merge is disabled for more than 20 selected rows, but the inline hint covers only "fewer than 2". | Add an `@else if (selected().length > 20)` hint: "Merge at most 20 matches at once." |
| MATCH-11 | Low | ux | src/app/pages/matches.ts:88, :97-101 | The archived checkbox and the status chips apply at once, and that also applies any half-typed search or dates. Text fields wait for Apply. The two apply modes are mixed in one form. | Make the checkbox and chips part of the pending state (applied by Apply), or say in the UI that chips apply immediately. |
| MATCH-12 | Low | a11y | src/app/pages/matches.ts:82-84 | When `dateError()` is set, the date inputs get no `aria-invalid`, so the red border style (styles.scss:419) never shows. | Add `[attr.aria-invalid]="!!dateError() \|\| null"` to both date inputs. |
| MATCH-13 | Low | layout | src/app/pages/matches.ts:194 | The local `@media (max-height: 500px) { .table-wrap.tall … }` repeats the global rule at styles.scss:203-206. | Delete the local rule. |
| MATCH-14 | Low | glass | src/app/pages/matches.ts:106 | The selection bar is a bare `.row` with no surface, placed between two glass panels. | Make it `.panel` with tighter padding. |

### match-detail

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| MDET-1 | Med | spinner | src/app/pages/match-detail.ts:151, :166 | Prediction history has no loading or error state. While `predResource` loads, or if it fails, it shows "Prediction history (0)" and "No predictions yet.", which is wrong. | Branch on `predResource.isLoading()` and `predResource.error()`: spinner `.empty-state` or `mm-state`, and an error row with Retry. |
| MDET-2 | Med | layout | src/app/pages/match-detail.ts:175-176 | The live stats table is not inside `.table-wrap`. Its `th` cells hold the full team names, which do not wrap (`.dt th` is nowrap). At 375px, long names push the table out of the panel. | Wrap it in `<div class="table-wrap">` and put the team names in `<span class="truncate">`, or use Home/Away headers with the full name in `title`. |
| MDET-3 | Low | spinner | src/app/pages/match-detail.ts:62-63, :408-412 | "Copy settlement input" calls the API, but it has no busy state, is never disabled and shows no spinner. A double click sends two requests and gives two toasts. | Add a `copying` signal and use the same `[disabled]` plus `pi-spinner pi-spin` icon swap as Settle (line 59). |
| MDET-4 | Low | a11y | src/app/pages/match-detail.ts:59 | The Settle icon `<i>` has no `aria-hidden="true"`. The other icons in this header have it (lines 56, 63). | Add `aria-hidden="true"`. |
| MDET-5 | Low | ux | src/app/pages/match-detail.ts:59, :317 | "Settle pending picks" writes settlement results at once, with no confirm. Unlink and Recalculate both go through a dialog. | Ask with `ConfirmService.ask({ header: 'Settle pending picks', … })` before `settleMatch`. |
| MDET-6 | Low | font-size | src/app/pages/match-detail.ts:213 | The score-pair field labels use `.fact-label` (`--fs-xs`, 12px). Status and Reason in the same dialog use `.field > label` at body size and weight 500. | Use `<label>` or `<span class="field-label">` styled like `.field > label`, or reuse the Status label style. |
| MDET-7 | Low | a11y | src/app/pages/match-detail.ts:215-217, :223 | A pair validation error ("Final score: enter whole numbers…") does not mark the inputs `aria-invalid` and is not linked with `aria-describedby`. | Track the failing pair and bind `[attr.aria-invalid]` plus `aria-describedby` to the error element's id. |
| MDET-8 | Low | layout | src/app/pages/match-detail.ts:38, :53 | `.head-actions { justify-content: flex-end }`. On mobile the header wraps below a left-aligned title, so 3-4 buttons end up ragged and right-aligned. | Under 640px set `justify-content: flex-start` on `.head-actions`. |
| MDET-9 | Low | a11y | src/app/pages/match-detail.ts:120 | The Win rate definition exists only in the `th` `title` attribute. Touch and keyboard users cannot reach it. | Add a visible hint (`.page-note`) or an info icon button with the text, or say it in the panel header. |
| MDET-10 | Low | color | src/app/pages/match-detail.ts:73 | A successful result save shows as `.page-note`, muted grey text. It reads like help text, not as feedback. | Use `<div class="alert alert-success" role="status">`. |
| MDET-11 | Low | ux | src/app/pages/match-detail.ts:152 | "Showing the latest N" gives no way to see the rest of the history. | Add a link to `/predictions?search=<externalMatchId>`, or a paginator like matches.ts. |

### import

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| IMP-1 | Med | ux | src/app/pages/import.ts:193, :316 | The `pattern` on Provider is never enforced. FormsModule adds `novalidate` to the form, and `canSend()` does not check the pattern. An invalid provider is caught only after the round-trip, as an INVALID_PROVIDER server error. | Test the regex in `hint()` ("Provider: 2–64 characters a-z, 0-9, - or _"). Bind `aria-invalid` and a `small.err` under the field. |
| IMP-2 | Med | spinner | src/app/pages/import.ts:188-262, :321-323 | While a multi-prediction send runs, the textarea and fields stay editable. Any edit calls `onPaste`, which runs `results.set([])` and wipes results from the loop still in progress. | Wrap the fields in `<fieldset [disabled]="busy()">`, the same pattern as `mm-dialog` (kit.ts:98). |
| IMP-3 | Low | spinner | src/app/pages/import.ts:256-258 | During a send the button shows only a spinner and keeps the label "Send N predictions". There is no progress for sequential requests. The icon has no `aria-hidden`. | Change the label to `Sending {{ results().length + 1 }} of {{ n }}…` while busy and add `aria-hidden="true"` to the icon. |
| IMP-4 | Low | color | src/app/pages/import.ts:260, :267 | `#imp-hint` uses `.warn-text` (amber) for neutral next-step guidance such as "Enter the provider to send." The page looks like it shows a warning before the user does anything. | Use `muted-text` for the hint. Keep `warn-text` for real warnings (new provider/model, missing fields). |
| IMP-5 | Low | a11y | src/app/pages/import.ts:237 | Error results get `role="status"`. Failures should be announced assertively. | Bind `[attr.role]="r.status === 'error' ? 'alert' : 'status'"`, as in the toasts (kit.ts:71). |
| IMP-6 | Low | a11y | src/app/pages/import.ts:205-207, :213 | The Agent reply is marked required only with an aria-hidden `*`. The textarea has no `required` or `aria-required`. The parse error is not linked with `aria-describedby` and sets no `aria-invalid`. | Add `required`, plus `[attr.aria-invalid]="!!(text() && parsed().error) \|\| null"` and `aria-describedby` pointing to the error id. |
| IMP-7 | Low | ux | src/app/pages/import.ts:213, :277 | The text is parsed on every keystroke, so the "not valid JSON at line…" error flashes while the user types or edits. | Show the error after blur or on submit, or debounce it (for example, a `touched` signal set on blur or paste). |
| IMP-8 | Low | ux | src/app/pages/import.ts:209, :328 | "Use example" replaces the pasted reply with no confirm and no undo. | When `text().trim()` is set, ask with `ConfirmService.ask(...)` before calling `onPaste(SAMPLE_REPLY)`. |
| IMP-9 | Low | layout | src/app/pages/import.ts:217-219 | The 7-column preview table has no `compact-sm` or `hide-sm`, so it scrolls sideways at 375px. The count columns (#, Picks, Odds) are not `.num`, so they are left-aligned. | Add `class="dt compact-sm"`, `num` on the #/Picks/Odds columns, and `hide-sm` on Type/Odds. |
| IMP-10 | Low | font-size | src/app/pages/import.ts:268 | The local `@media (max-width:640px) { input.input, textarea.input { font-size:16px } }` repeats the global rule at styles.scss:642-643, using px instead of rem. | Delete the local rule. |

## Predictions / Prediction detail / Models / Model detail

### predictions

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| PRED-1 | Med | spinner | src/app/pages/predictions.ts:97 | On first load (no rows yet) the table shows the plain text "Loading…" in the empty cell. Other screens use the `mm-state` skeleton, so this loading state looks different and the row height jumps when data arrives. | Render `<mm-state state="loading" [rows]="6" />` (or `.skeleton` rows) inside the empty `<td>`. |
| PRED-2 | Low | layout | src/app/pages/predictions.ts:102 | The "no results" state is bare text. The error branch next to it (line 99) and `models.ts:64-65` use `.empty-state` with an icon and a heading. | Wrap it in `<div class="empty-state"><i class="pi pi-filter-slash">…<strong>…</strong></div>`, plus a hint to Reset the filters. |
| PRED-3 | Low | layout | src/app/pages/predictions.ts:68 | The "Top pick result" column is `.sticky-end`, but up to 5 optional columns come after it (Type, Min, At capture, CS prob., Picks; lines 69-73). While the table scrolls sideways, the pinned cell covers those columns. The pinned "answer" column is also not at the end. | Move the Result `<th>`/`<td>` (line 88) after the optional columns so it is the last column, or drop `sticky-end` when columns follow it. |
| PRED-4 | Low | font-size | src/app/pages/predictions.ts:115 | `.units { font-size: .8rem }` is an ad-hoc size that is not on the scale. | Use `var(--fs-sm)` (or `--fs-xs`). |
| PRED-5 | Low | glass | src/app/pages/predictions.ts:42-49 | The Columns `details.menu` has no outside-click or Esc close. It stays open over the table after the user picks columns. Its glass `menu-body` (blurred `--mm-card` at .62 alpha) also sits over dense table text. | Close it on `(focusout)`/document click and Esc. Use `--mm-card-solid` for the menu body here, as for other surfaces content scrolls under. |
| PRED-6 | Low | a11y | src/app/pages/predictions.ts:68, 80, 93 | Some meaning is given only by `title` tooltips: the definition of the result column, the "not counted" explanation, and the full pick summary. Touch and keyboard users never see them. | Put the explanation in visible `.cell-sub`/`.page-note` text, or in an `sr-only` span referenced by `aria-describedby`. |

### prediction-detail

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| PDET-1 | High | layout | src/app/pages/prediction-detail.ts:131-139 | The expanded history row inherits `.dt td { white-space: nowrap }` from styles.scss:452, and `.dt tr.expanded > td` (styles.scss:470) does not reset it. The settlement sentence (l.137) and the admin reason (l.138) therefore never wrap. The local `.hist-item { overflow-wrap: anywhere }` (l.25) has no effect under nowrap. Long text makes the table scroll sideways, worst at 375px. | Add `white-space: normal` to the expanded `<td>` (for example a local `.dt tr.expanded > td { white-space: normal; }`), and cap prose width at about `max-width: 80ch`. |
| PDET-2 | Med | layout | src/app/pages/prediction-detail.ts:149-152 | The Odds table has 12 columns. It has no `compact-sm` and no `hide-sm`, and Ref/Stage/Basis are not pinned. At 375px it is a wide sideways scroll with no visual anchor. | Add `compact-sm`, mark Ref, #, Basis and Captured `hide-sm`, or pin the Stage column. |
| PDET-3 | Med | layout | src/app/pages/prediction-detail.ts:183, 190, 213, 173 | The Stats, Other stats, probability and Correct scores tables are not wrapped in `.table-wrap`. The team names in the `<th>` are nowrap, so a long name overflows the page at 375px. | Wrap each table in `<div class="table-wrap">`, like the Picks and Odds tables. |
| PDET-4 | Med | ux | src/app/pages/prediction-detail.ts:124 | "Recalculate" is disabled for a pending pick on an unfinished match, with no explanation. "Override" (l.126) explains itself only through `title`, which a disabled button does not show on touch or keyboard focus. | Show the reason as visible text (a `.cell-sub` under the buttons), or keep the buttons enabled and show the blocker inside the dialog. |
| PDET-5 | Med | ux | src/app/pages/prediction-detail.ts:40 | The load error shows `mm-state` with no Retry button. `predictions.ts:100` and `models.ts:33` both offer one. | Add a Retry button with `btn btn-outline btn-sm` that calls `resource.reload()` when `state() === 'error'`. |
| PDET-6 | Low | layout | src/app/pages/prediction-detail.ts:259 | The reason hint `<small id="ov-hint">` sits outside the `.field` div. The `.stack` 1rem gap then separates it from the textarea it describes. | Move it inside the `.field` div at l.256 (`.field small` already spaces it). |
| PDET-7 | Low | layout | src/app/pages/prediction-detail.ts:144 | The empty-row `colspan="11"` does not match the 10 columns shown to non-admins. | Use `[attr.colspan]="auth.isAdmin() ? 11 : 10"`, as on l.131. |
| PDET-8 | Low | layout | src/app/pages/prediction-detail.ts:81 | The Similar predictions `<ul>` uses the browser's default bullets and 40px indent inside a glass panel, and the tags have no spacing. | Use a classless list with `list-style: none; padding: 0`, rows separated by `.hist-item`. |
| PDET-9 | Low | layout | src/app/pages/prediction-detail.ts:211, 213 | `.prob-tables` is a wrapping flex row, but each `table.dt` is `width: 100%`. Every table therefore takes a full row, and they never sit side by side. | Give the tables `width: auto; flex: 1 1 14rem` inside `.prob-tables`. |
| PDET-10 | Low | layout | src/app/pages/prediction-detail.ts:210, 233 | Section headings use `h3.mb-2`, while siblings use `h3.sub-h` (l.189, 223, 229, 234). The spacing and size are inconsistent. | Use `.sub-h` for all of them, and override only the top margin on the first one. |
| PDET-11 | Low | font-size | src/app/pages/prediction-detail.ts:204 | The Iterations value is a raw number (for example 100000) with no grouping separators. | Format it with `toLocaleString()` or a `format.ts` helper. |
| PDET-12 | Low | ux | src/app/pages/prediction-detail.ts:313-314 | A failed needs-review request is silently replaced by `[]`. The review banner and "Needs review" tags then disappear with no warning. | Show an `alert alert-warn` when `reviewResource.error()` is set. |

### models

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| MOD-1 | Med | spinner | src/app/pages/models.ts:35, 80 | Ticking "Show archived and merged" changes the resource params, so the status becomes `loading` and `viewState` maps it to 'loading'. The whole table panel is swapped for the skeleton, which causes a large layout shift on every toggle. | Keep the panel rendered while a value exists (`resource.hasValue()`), and show `[class.loading]`/`aria-busy` on the table, as `predictions.ts:57` does. |
| MOD-2 | Med | layout | src/app/pages/models.ts:56, 58 | On mobile, Win rate and ROI stay visible, and each can carry a nowrap `mm-small-sample` tag ("small sample (n = 3)"). With Model and W/L also shown, the 375px table overflows sideways. | Under 640px, put the tag on its own line (`display:block`) or shorten it to "n=3" with the full text in `sr-only`. |
| MOD-3 | Low | layout | src/app/pages/models.ts:31-34 | The Retry button sits outside the `mm-state` error box, as a loose button below it. In `predictions.ts:99-100` Retry sits inside the error state. | Put Retry inside a `.state-box.error`/`.empty-state`, or project it into `mm-state` (it supports `<ng-content>` only for empty). |
| MOD-4 | Low | ux | src/app/pages/models.ts:70 | The paginator shows "0–0 of 0 models" under the empty state. | Wrap it in `@if (filtered().length)`. |
| MOD-5 | Low | a11y | src/app/pages/models.ts:41-43 | The Win rate, Units and ROI definitions exist only as `title` on the sortable `<th>`. They are hover-only and not reachable by touch. | Add a `.page-note` with the definitions, or a visible info toggle. |

### model-detail

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| MDL-1 | Med | spinner | src/app/pages/model-detail.ts:57-58, 112 | While `dashboardResource` loads, and also when it fails, `trend()` is null. The panel then claims "Not enough settled days for a trend yet." That is a wrong message during loading and on error, and the panel jumps when the chart arrives. | Branch on the resource status: show `.skeleton`/`.chart-box` while loading, an error line on failure, and the empty text only when the data really has fewer than 2 days. |
| MDL-2 | Med | color | src/app/pages/model-detail.ts:139-140 | The chart colors are hard-coded (`'#4f46e5'`, `'rgba(79,70,229,.12)'`) instead of tokens. In dark mode this indigo line on `--mm-card` (#161b3a/#0a0d1f) is about 2.3:1, which is below the 3:1 non-text minimum. `chart.ts` already reads tokens through `token()`. | Read `--mm-green`/`--mm-lime` through the `chart.ts` token helper, so dark mode uses the light accent. |
| MDL-3 | Med | select | src/app/pages/model-detail.ts:98-102, 92 | The Merge select gives no feedback while `siblingsRes` loads, nor when no target exists (only the placeholder shows). Merge stays disabled with no reason given. | Show a loading option or `pi-spin` while it loads. When `mergeTargets()` is empty, add "No other model of this provider can be a target." |
| MDL-4 | Med | ux | src/app/pages/model-detail.ts:26 | The load error has no Retry button, unlike `models.ts:33`. | Add a Retry button with `btn btn-outline btn-sm` and `resource.reload()`. |
| MDL-5 | Low | select | src/app/pages/model-detail.ts:95, 99 | The rename `input.input` and merge `select.input` have no `w-full`. The override select in `prediction-detail.ts:250` and the textarea in the reason dialog are full width, so control widths differ inside one dialog. | Add the `w-full` class. |
| MDL-6 | Low | color | src/app/pages/model-detail.ts:84 | The Final score is always `[muted]="true"`, even for finished matches. `predictions.ts:87` mutes only when `matchStatus !== 'FINISHED'`, so the same data has different styling on two screens. | Use `[muted]="p.matchStatus !== 'FINISHED'"`. |
| MDL-7 | Low | a11y | src/app/pages/model-detail.ts:46-47, 65 | The ROI and Units definitions and the Win rate formula exist only as `title` on KPI tiles and `<th>`. They are hover-only. | Show the definition as a visible `.kpi` sub-line or `.page-note`. |
| MDL-8 | Low | font | src/app/pages/model-detail.ts:138 | Chart x labels are raw `d.day` ISO strings (YYYY-MM-DD). This differs from `fmtDateTime` used elsewhere on the page. | Format the labels with a short day format from `format.ts`. |
| MDL-9 | Low | ux | src/app/pages/model-detail.ts:40, 75 | The header offers a "View all N predictions" button, and the Latest predictions panel repeats it as a "View all" link to the same target. | Keep only one of them (the panel header link). |

## Prompts / Providers / Reports

### prompts

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| PROMPT-1 | Med | ux | src/app/pages/prompts.ts:166 | The "New prompt template" `mm-dialog` has no `[busy]`. During `create()`, Esc, the X button and Cancel (l.176) still close it, and every field stays editable. | Bind `[busy]="saving()"`, as providers.ts:79 does. |
| PROMPT-2 | Med | ux | src/app/pages/prompts.ts:166,176 | Closing the create dialog (Esc, X or Cancel) throws away typed name and content with no confirm. The editor has `confirmDiscard()`, but this dialog does not use it. | Call `confirmDiscard()` in `(closed)` when `newContent()` or `newName()` is not empty. |
| PROMPT-3 | Med | font | src/app/pages/prompts.ts:172 | The create-dialog Content textarea is outside `.prompt-editor`, so it renders in the proportional font. The editor (l.114), `.prompt-view` and the diff all use mono. | Add a mono class (`font-family: var(--mm-mono)`) to `#np-content`. |
| PROMPT-4 | Med | a11y | src/app/pages/prompts.ts:169,177 | An invalid Type only disables Create. There is no `aria-invalid` and no error text, so the user cannot tell why the button is disabled. | Set `[attr.aria-invalid]="newType() && !typeValid()"` and show `small.err` when the value is invalid. |
| PROMPT-5 | Med | a11y | src/app/pages/prompts.ts:174 | `createError` is a plain `div.field-error` with no `role="alert"`, so screen readers do not announce it. providers.ts:90 uses `role="alert"`. | Add `role="alert"`. |
| PROMPT-6 | Med | spinner | src/app/pages/prompts.ts:83,401-410 | History gives no feedback while versions load. The dialog opens only after the response, and the button stays enabled, so repeated clicks fire repeated requests. | Add a `loadingHistory` signal that disables the button and swaps the icon to `pi-spinner pi-spin`, like Save (l.96). |
| PROMPT-7 | Low | spinner | src/app/pages/prompts.ts:139,415-422 | Picking a version shows no loading state. The previously selected version's diff stays on screen until the new one arrives. | Clear `version` or set `aria-busy` while fetching, and show `<mm-state state="loading" [rows]="4">`. |
| PROMPT-8 | Low | spinner | src/app/pages/prompts.ts:91,346 | `copying()` is set only on the provider path. The shared-key path (`promptForAgent`) leaves Copy enabled with no spinner, so a double click fires two requests. Copy also never shows a spinner during the rotate flow. | Set `copying` around the shared-key call too, and swap to the `pi-spinner pi-spin` icon. |
| PROMPT-9 | Low | spinner | src/app/pages/prompts.ts:106,325 | "Reload latest" has no busy or disabled state while it fetches. | Add a busy signal, `[disabled]` and a spinner icon. |
| PROMPT-10 | Low | ux | src/app/pages/prompts.ts:150,426 | Restore publishes an old version as the new live prompt in one click, with no confirm. Agents pick up the changed text. | Ask first: `confirm.ask({header:'Restore vN?', acceptLabel:'Restore'})`. |
| PROMPT-11 | Low | color | src/app/pages/prompts.ts:187 | `.d-add` uses `--mm-green-soft`/`--mm-green-ink`, which are the indigo primary. Added diff lines read as "selected" rather than "added". | Use an emerald tint based on `--mm-win`, or a dedicated `--mm-add-soft` token. |
| PROMPT-12 | Low | font-size | src/app/pages/prompts.ts:115,173 | The counter swaps its class between `field-error` (fixed .8rem) and `muted-text` (inherits the `<small>` size), so the text changes size when the limit is crossed. | Keep one size and toggle only the colour (for example `muted-text` plus `[class.err]`). |
| PROMPT-13 | Low | a11y | src/app/pages/prompts.ts:114 | The main Content textarea has only an `aria-label`. Description (l.112) has a visible label, Content does not. | Add `<label for="pr-content">Content</label>`. |
| PROMPT-14 | Low | select | src/app/pages/prompts.ts:85 | The provider `<select>` sits between History and Copy with no visible label. Its link to Copy, and the fact that it triggers a key rotation, is not visible. | Group it with Copy, for example with a `<label class="sr-only">` plus a visible "Copy for:" prefix. |
| PROMPT-15 | Low | layout | src/app/pages/prompts.ts:63 | Below 900px, `.prompt-layout` stacks into one column, so the full template list comes before the editor with no max-height. On a phone, the editor sits below a long list of buttons. | Below 900px, cap `.prompt-list` (`max-height: 30vh; overflow:auto`), as history-list does at l.189. |
| PROMPT-16 | Low | layout | src/app/pages/prompts.ts:69 | The empty list uses a bare `p.muted-text` instead of the shared empty state. | Use `<mm-state state="empty" message="No prompt templates yet." icon="pi-file">`. |
| PROMPT-17 | Low | font | src/app/pages/prompts.ts:123,125 | `<code>` has no `font-family` rule, so it uses the browser default monospace, not IBM Plex Mono. | Style `code` with `var(--mm-mono)`, or scope it in the component. |

### providers

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| PROV-1 | High | ux | src/app/pages/providers.ts:128,270-274 | Rotate kills the active key instantly with no confirm. prompts.ts:372 confirms the same action ("Rotate key …? stops working now"), and Revoke here asks for a reason. | Wrap it in `ConfirmService.ask({danger:true, acceptLabel:'Rotate'})`, or route it through `mm-reason-dialog` like Revoke. |
| PROV-2 | Med | ux | src/app/pages/providers.ts:99,147,256 | An issued or rotated key is shown once. Close, X or Esc then clears it with no warning, and the key cannot be recovered. | When `issued()` is set, confirm before `closeKeys()` ("You have not copied the key…"). |
| PROV-3 | Med | layout | src/app/pages/providers.ts:115 | The keys table has 6 nowrap columns, tags and 3 action buttons, and is not wrapped in `.table-wrap`. At 375px it overflows the dialog body. | Wrap it in `<div class="table-wrap">`, and add `hide-sm` to Label and Scopes. |
| PROV-4 | Med | spinner | src/app/pages/providers.ts:118,133,308 | Keys have no loading state. "No keys yet." shows while `providerKeys` is still fetching, which is misleading. | Track a loading signal and render `<mm-state state="loading" [rows]="3">` until the first response. |
| PROV-5 | Med | ux | src/app/pages/providers.ts:145,311 | A key-list load failure is written to `formError`. It then shows above the "Issue key" button as if issuing had failed. | Use a separate `keysError` and show it as `.alert-error` with Retry above the table. |
| PROV-6 | Med | a11y | src/app/pages/providers.ts:55 | The disable reason exists only in `title` (hover only), so keyboard, touch and screen-reader users cannot reach it. | Render it as `<span class="cell-sub">{{ p.disabledReason }}</span>` under the tag. |
| PROV-7 | Med | a11y | src/app/pages/providers.ts:142,157 | Scope hints, including the safety warning "only for a trusted results feeder", exist only in `title` on the label. | Show the hint as a `small.muted-text` under each checkbox, linked with `aria-describedby`. |
| PROV-8 | Med | layout | src/app/pages/providers.ts:62-67 | Four text buttons per row (Keys, Edit, Disable, Archive) with nowrap and no sticky column. At 375px the actions scroll off-screen. | Use the `.sticky-end` class (not the settings.ts:183 local copy, see SET-9), or collapse into a `details.menu` overflow menu. |
| PROV-9 | Med | spinner | src/app/pages/providers.ts:93,148 | Save and Issue key only disable while busy and show no spinner. `ReasonDialog` (ui.ts) and prompts Save show `pi-spinner pi-spin`. | Add `@if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> }`. |
| PROV-10 | Low | spinner | src/app/pages/providers.ts:111,301 | "Copy prompt with this key" has no busy state, so double clicks are possible and there is no feedback while the fetch runs. | Add a `copying` signal for `[disabled]` and a spinner icon. |
| PROV-11 | Low | select | src/app/pages/providers.ts:108-110 | The prompt `<select>` renders empty with no option when no template has `{{EXTERNAL_API_KEY}}`. The Copy button is then disabled with no explanation. | Show an "No prompt contains {{EXTERNAL_API_KEY}}" option or note, and hide the select. |
| PROV-12 | Low | ux | src/app/pages/providers.ts:105 | The full API key stays on screen in plain text until the dialog closes, which is a shoulder-surfing risk. | Mask it by default with a reveal toggle, like `.password-wrap`, and keep Copy working on the raw value. |
| PROV-13 | Low | layout | src/app/pages/providers.ts:140,155 | `fieldset.field` has no reset (only `fieldset.dialog-body` is reset), so the browser's default border and padding show inside the dialog. | Add `fieldset.field { border:0; padding:0; margin:0; min-width:0; }` and style the legend like `.field > label`. |
| PROV-14 | Low | layout | src/app/pages/providers.ts:115,136 | The `mt-2` utility does not exist (only `.mb-2` is defined), so the table and form get no top spacing. | Use `.stack` spacing, or add an `.mt-2` token utility next to `.mb-2`. |
| PROV-15 | Low | layout | src/app/pages/providers.ts:133 | The empty keys row uses `class="muted-text"` instead of `.empty`, which the providers table uses at l.71. | Use `class="empty"`. |
| PROV-16 | Low | ux | src/app/pages/providers.ts:83-85 | Code rules ("2–64 of a-z…") are not checked on the client. There is no `pattern` and no `aria-invalid`, and the error appears only after the server rejects it. | Add `pattern="[a-z0-9_-]{2,64}"` and `[attr.aria-invalid]`. |
| PROV-17 | Low | font | src/app/pages/providers.ts:31,52,120 | `<code>` uses the browser default monospace, while the key input uses `var(--mm-mono)` (l.163). | Apply `font-family: var(--mm-mono)` to `code`. |

### reports

| ID | Severity | Category | Location | Issue | Suggested fix |
|---|---|---|---|---|---|
| REP-1 | Med | color | src/app/pages/reports.ts:538,543-546 | Chart colours are hard-coded hex values that drift from the tokens: wins `#059669` vs `--mm-win #047857`, losses `#e11d48` vs `--mm-loss`, pending `#c98a00` vs `--mm-pending`. They do not follow the dark theme. | Read them with `getComputedStyle(...).getPropertyValue('--mm-win')` and similar, as chart.ts `token()` does. |
| REP-2 | Med | color | src/app/pages/reports.ts:538,563-564 | In dark mode, indigo `#4f46e5` bars and points on the dark card (`#161b3a`) reach about 2.1:1, below the 3:1 non-text contrast minimum. | Use `--mm-lime`/`#818cf8` in dark mode, or a token-driven series colour. |
| REP-3 | Low | color | src/app/pages/reports.ts:563-566 | Thin bins and the "Perfect calibration" reference line share the same grey (`#8a96a8`), so the two are easy to confuse. | Give the reference line `--mm-ink-3` with a dash and thin bins a hollow marker, or add a legend. |
| REP-4 | Low | ux | src/app/pages/reports.ts:549 | The win-rate tooltip shows the raw value, for example "Win rate: 57.143", with no % and up to 3 decimals. | Add `tooltip.callbacks.label: ctx => pct(ctx.raw/100)`. |
| REP-5 | Med | layout | src/app/pages/reports.ts:230-231,397-398,168 | Expanded rows sit in a `td` that inherits `.dt td { white-space: nowrap }` and spans the full table width (16–17 columns). The `grid-3` details stretch far right and require horizontal scrolling. | Set `white-space: normal` on `.expanded > td` and wrap the content in a `position: sticky; left:0; max-width: <viewport>` box. |
| REP-6 | Med | layout | src/app/pages/reports.ts:320-321,372-374 | The comparison (13 columns) and Monte Carlo (17 columns) tables have no `hide-sm` classes, unlike the performance tables (`hideSm`). At 375px they need very long horizontal scrolling. | Mark secondary columns `hide-sm` (xG, xCorners, CS prob., Odds, Predictions) and keep match, model, pick and outcome. |
| REP-7 | Med | ux | src/app/pages/reports.ts:254,407 | Load errors print as plain text inside the empty table cell and look the same as "No picks…". There is no error styling and no retry. | Render `<mm-state state="error">` (`.state-box.error`) above the table when `state()==='error'`. |
| REP-8 | Low | spinner | src/app/pages/reports.ts:254,407 | The first load shows the text "Loading…" in a single cell. The other tabs use the `mm-state` skeleton. | Use `<mm-state state="loading">` for the empty-and-loading case. |
| REP-9 | Med | layout | src/app/pages/reports.ts:355-368 | Monte Carlo KPIs render only once data arrives. There is no placeholder during the first load, so the table jumps down by a full KPI row. | Render the `.kpis` grid with `.skeleton` values while `state()==='loading'` and data is empty. |
| REP-10 | Med | layout | src/app/pages/reports.ts:182-189 | The Columns `details.menu` (absolutely positioned) lives inside `.panel.flush`, which has `overflow: hidden`. With few or no rows, the menu is clipped. It also does not close on outside click or Esc. | Put the toolbar outside `.panel.flush`, or allow `overflow: visible` on that panel. Close on `focusout` or Esc. |
| REP-11 | Low | a11y | src/app/pages/reports.ts:295 | Thin calibration bins are marked only by grey text (`muted-text`), which relies on colour alone (WCAG 1.4.1). | Add a text marker, such as a `tag-warn` "few picks" or `<mm-small-sample>`. |
| REP-12 | Low | a11y | src/app/pages/reports.ts:158,207,379 | Every row's toggle button has the same `aria-label` ("Toggle breakdown", "Toggle details", "Toggle distribution"), so screen readers cannot tell which row a button belongs to. | Include the row name: `[attr.aria-label]="'Breakdown for ' + r.modelName"`. |
| REP-13 | Low | a11y | src/app/pages/reports.ts:153,275 | The ROI and Units definitions are available only through the header `title` (hover only). The win-rate definition is repeated in toolbar text, but ROI is not. | Add `ROI_DEF` to the toolbar note next to `winRateDef`, or use a focusable info button. |
| REP-14 | Low | layout | src/app/pages/reports.ts:320,335 | "Type / min" uses `class="num"` (right-aligned) although it holds text such as "Pre match · 45'". | Drop `num` from both the header and the cell. |
| REP-15 | Low | font-size | src/app/pages/reports.ts:357 | `simulatedPredictions` is shown raw, while the other KPIs go through `num()`, so thousands separators are inconsistent. | Use `{{ num(mc.summary.simulatedPredictions, 0) }}`. |
| REP-16 | Low | layout | src/app/pages/reports.ts:133,361-366 | The local `.kpi .kpi-sub` lacks `grid-column: 1 / -1` and `color`, which dashboard.ts:38 defines. The same class renders differently on the two pages. | Move `.kpi > .kpi-sub` into styles.scss once and drop both local copies. |
| REP-17 | Low | layout | src/app/pages/reports.ts:146 | The `count-note` class is used but defined only in dashboard.ts, so it is dead here. | Remove it, or define it globally. |
| REP-18 | Low | ux | src/app/pages/reports.ts:186,621 | Columns can all be unchecked, which leaves the table with only the expand column. | Disable the last checked checkbox, or keep Match and Result always visible. |

