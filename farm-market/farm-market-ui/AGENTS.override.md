# Farm Market UI Guidelines

## Scope

Angular 22 standalone storefront + account + admin client for "Đồi Nắng" (UI copy in Vietnamese, VND). Strict TypeScript,
Signals, lazy routes. Currently runs on mock data in `src/app/core/mock-data.ts`; no backend calls yet. The source of
truth for screens/copy/tokens is `../designs/Doi Nang Farm Mockups.html`.

## Change Rules

- Keep standalone components, Signals, `*.page.ts` naming for routed screens, two-space formatting.
- Money is integer VND; format only through `core/format.ts`. Never use floating point for totals.
- Branch theme colors flow through CSS variables set by `core/branch.store.ts`; do not hard-code the primary color.
- Customers hitting `/admin` go home; staff see only assigned branches; checkout -> login returns to `/checkout`.
- Never put secrets in client code. Keep loading/empty/error states and keyboard focus.

## Verification

Do not run tests or a dev server unless asked. When visual QA is requested, check the real route at 1440 and 390 px.
