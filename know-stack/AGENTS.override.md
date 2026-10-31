# know-stack — module rules

KnowStack: developer knowledge library + interview prep, built from `mockup/` (design tokens in `mockup/devvault/DESIGN.md`).
One Cloudflare Worker: Hono API under `/api/*` (`worker/`), React SPA served as static assets (`src/`), D1 via Drizzle.

## Change rules

- Schema: edit `worker/db/schema.ts`, then `npm run db:generate` to add a new migration in `migrations/`. Never edit an applied migration.
- Visitor geo comes from ip-api.com, cached once per IP in `ip_geo` (`worker/geo.ts`). Never call it per page view (free tier: 45 req/min, HTTP only). Client IP only from `CF-Connecting-IP`.
- Tracking (`src/useTrack.ts`, `worker/routes/track.ts`) must never block or break page loads.
- Every `/api/admin/*` route stays behind `requireAdmin`; admins are the emails in `ADMIN_EMAILS`.
- The agent API (`/api/agent/*`, bearer `AGENT_TOKEN`) may only create drafts — never publish.
- Rendered markdown always goes through DOMPurify (`src/components/Markdown.tsx`).
- D1 rejects `LIKE` patterns over 50 bytes: use `instr()` for user-supplied text matching.

## Verification

- `cd know-stack && npx vitest run && npx tsc -b`
- UI changes: `npx vite --port 5317` and inspect the rendered page.
