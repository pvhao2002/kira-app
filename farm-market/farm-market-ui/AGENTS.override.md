# Farm Market UI Guidelines

## Scope

Angular 22 standalone storefront + account + admin client for "Kira Farm" (UI copy in Vietnamese, VND). Strict TypeScript,
Signals, lazy routes. Currently runs on mock data in `src/app/core/mock-data.ts`; no backend calls yet. The source of
truth for screens/copy/tokens is `../designs/Kira Farm Mockups.html`.

## Change Rules

- Keep standalone components, Signals, `*.page.ts` naming for routed screens, two-space formatting.
- Every component is split into three sibling files: `name.ts` (logic), `name.html` (`templateUrl`) and `name.css` (`styleUrl`). Do not add inline `template:` or `styles:`; plain CSS only (global tokens and shared classes live in `src/styles.css`).
- Money is integer VND; format only through `core/format.ts` in code and the `vnd` pipe (`shared/vnd.pipe.ts`) in templates — do not call `vnd()` from templates. Never use floating point for totals.
- Loading / error(+retry) / empty branches use `<app-state-box>` (`shared/state-box`); keep the page's own `@if` chain so data is never read before it is ready. Errors always surface (role=alert) and any control that triggers an API call is disabled while the request is in flight (try/finally busy signal). Track `@for` by a stable id, not `$index`, whenever items have one.
- Branch theme colors flow through CSS variables set by `core/branch.store.ts`; do not hard-code the primary color.
- Customers hitting `/admin` go home; staff see only assigned branches; checkout -> login returns to `/checkout`.
- HTTP: reads (GET) use `apiResource()` from `core/api.ts` (a thin wrapper over Angular's `httpResource` that adds `/api/v1`, drops empty params and stays idle when the request function returns `undefined`); drive the UI from `isLoading()`, `error()`, `hasValue()` and call `reload()` after a successful mutation. `value()` THROWS while the resource is in the error state (even with a `defaultValue`), so always guard it with `hasValue()`. Writes (POST/PUT/DELETE) go through `Api` (HttpClient) and throw `ApiError`; there is no `Api.get`.
- Syntax: services use `@Service()` (not `@Injectable({providedIn: 'root'})`), components use `input()/output()/model()/viewChild()` (no decorators, no `EventEmitter`), control flow blocks (`@if/@for/@switch`), and forms use Signal Forms (`form()` + `FormField` from `@angular/forms/signals`), not `ngModel`.
- Never put secrets in client code. Keep loading/empty/error states and keyboard focus.

## Verification

Do not run tests or a dev server unless asked. When visual QA is requested, check the real route at 1440 and 390 px.
