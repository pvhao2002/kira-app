# Kira UI Guidelines

## Scope

This Angular 21 application is the main web client for authentication, sports/crawl operations, predictions, finance, credit cards, travel checklists, tools, and administration.

## Change Rules

- Follow the standalone Angular and Signals patterns already in the code. Keep server access in `src/app/services` or `src/app/config`, route policy in guards/routes, and view state in the owning component.
- Preserve hash-based routing and existing auth/role behavior. Do not bypass guards or duplicate token handling in components.
- Keep API models and pagination/filter semantics synchronized with gateway and data-manager responses. Handle loading, empty, error, and retry states explicitly.
- Use two-space indentation, single quotes, the configured 100-column width, and lowercase hyphenated component folders. Prefer readable template expressions and reusable helpers for repeated formatting.
- Maintain responsive behavior and keyboard-visible focus. Controls removed by a requirement must be absent from the DOM, not merely disabled or hidden visually.
- Never place secrets in frontend environment/config files or expose sensitive API payloads in browser logs.

## Verification

Do not run `npm run build`, tests, lint, or a dev server unless explicitly requested. For visible changes, inspect the rendered page at the requested viewport when runtime QA is authorized; a build alone is not UI verification.
