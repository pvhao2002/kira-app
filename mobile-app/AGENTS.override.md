# Mobile App Guidelines

## Scope

This Expo 54 / React Native application uses Expo Router. Route files live in `app`, reusable presentation in `components`, screen implementations in `screens`, and shared state in `contexts` and hooks.

## Change Rules

- Keep `app` route files thin and preserve Expo Router groups, typed paths, redirects, and the authentication gate in the root/tab layouts.
- Reuse shared components, theme constants, and `AuthContext` instead of creating screen-local duplicates. Keep side effects and subscriptions cleanup-safe.
- Design for both Android and iOS safe areas, keyboard behavior, small screens, and dynamic text. Do not rely on web-only DOM or CSS APIs.
- Keep API URLs and environment differences centralized. Preserve authentication state across restarts and never log tokens, passwords, financial details, or arbitrary query results.
- Handle offline, loading, empty, permission-denied, and retry states. Avoid blocking the JS thread with large parsing or synchronous work.
- Keep TypeScript types aligned with the backend response actually consumed by each screen.

## Verification

Do not run Expo, native builds, lint, tests, or reset scripts unless explicitly requested. A web preview is not sufficient evidence for Android/iOS behavior; state any untested platform limitations clearly.
