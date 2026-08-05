# Kira Bank UI Guidelines

## Scope

This Angular 22 standalone application uses strict TypeScript, Signals, lazy feature routes, shared resource definitions, and a responsive light/dark interface.

## Change Rules

- Preserve standalone component and Signals patterns. Keep authentication in `core/auth`, HTTP policy in interceptors/services, layout in `core/layout`, and feature behavior in its owning page.
- Reuse `resource.page` and `resource-definitions.ts` for repeated CRUD behavior instead of cloning pages. Update shared API models whenever the backend contract changes.
- Preserve credentials/refresh behavior and route guards. Never put JWT, DB, R2, or AI secrets in client code or browser logs.
- Keep credit-card and investment sections visibly distinct. Format money and dates consistently and avoid binary floating-point calculations for client-side financial totals.
- Maintain responsive layouts, light/dark contrast, keyboard focus, translated labels, and explicit loading/empty/error states. A removed control must not remain in the DOM.
- Follow the repository EditorConfig, two-space TypeScript formatting, and existing `.page.*` naming.

## Verification

Do not run `npm run build`, tests, or a dev server unless explicitly requested. When visual QA is requested, verify the actual route in the browser at relevant desktop/mobile widths; compilation is not a substitute for rendered UI checks.
