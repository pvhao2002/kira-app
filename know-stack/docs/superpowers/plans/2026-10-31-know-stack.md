# KnowStack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build KnowStack (developer knowledge library + interview prep) from the 7 mockups in `mockup/`, with per-visit IP geo analytics via ip-api.com.

**Architecture:** One Cloudflare Worker. Hono serves `/api/*`; the React SPA (Vite build) is served as static assets with SPA fallback. D1 via Drizzle ORM. Mockup markup is ported to JSX with the DevVault Tailwind tokens.

**Tech Stack:** Hono, React 19, React Router 7, TypeScript, Vite + `@cloudflare/vite-plugin`, Tailwind v4, Drizzle ORM + D1, `marked` + `dompurify` (markdown), `mermaid` (lazy, only when a diagram exists), Vitest.

**Spec:** user request (2026-10-31) + `mockup/*/code.html` + `mockup/devvault/DESIGN.md`. User opted out of design questions ("just start, build all screens").

## Global Constraints

- Stack fixed by user: Hono + React + TypeScript + Drizzle ORM + Cloudflare D1.
- IP analytics uses `http://ip-api.com/json/{ip}` (free tier: HTTP only, 45 req/min) → cache one row per IP in D1; never call per page view.
- Client IP comes only from `CF-Connecting-IP` (never `X-Forwarded-For`, spoofable). Private/loopback IPs are not looked up.
- Geo lookup runs in `waitUntil`; tracking must never block or break page loads.
- Passwords: PBKDF2-SHA256 via WebCrypto, 100k iterations, random salt. Sessions: random token in D1, `HttpOnly; SameSite=Lax; Secure` cookie, 30 days.
- Admin = email listed in `ADMIN_EMAILS` var; enforced server-side on every `/api/admin/*` route.
- Mutating routes protected by `hono/csrf` (Origin check).
- Rendered markdown is sanitized with DOMPurify (AI output is untrusted).
- Secrets only in `.dev.vars` / wrangler secrets; `.dev.vars.example` documents shape.

## Screen → route map

| Mockup | Route |
|---|---|
| kira_knowledge_library_with_auth_modal, knowledge_library_technical_tracks | `/` and `/tracks/:category` (one `Library` page; auth modal opened from header) |
| article_detail_distributed_saga_pattern | `/articles/:slug` |
| ask_submit_technical_question | `/ask` |
| (sidebar "Question Queue") | `/admin/questions` |
| admin_studio_ai_article_editor_preview | `/admin/editor/:id?` |
| admin_studio_traffic_content_analytics | `/admin/analytics` |
| kira_admin_autonomous_ai_agent_computer_use_studio | `/admin/agents` |

## Review Focus

1. Local dev / private IP (`127.0.0.1`, `::1`, `10.x`) → visit recorded, no ip-api call, analytics shows "Unknown".
2. ip-api returns 429 or network error → visit still recorded; geo not cached so it retries later.
3. Non-admin calling `/api/admin/*` → 403; anonymous → 401.
4. Article markdown containing `<script>` / `onerror=` → stripped on render.
5. Duplicate register email → 409 with message, not 500.

---

### Task 1: Scaffold + schema + seed

**Files:** `package.json`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `drizzle.config.ts`, `index.html`, `.dev.vars.example`, `.gitignore`, `AGENTS.override.md`, `worker/db/schema.ts`, `migrations/*` (drizzle-kit generated), `seed/seed.sql`.

Tables: `users(id, email unique, name, password_hash, created_at)`, `sessions(token pk, user_id, expires_at)`, `categories(slug pk, name, icon, sort)`, `articles(id, slug unique, title, summary, body_md, category_slug, difficulty junior|mid|senior|staff, tags json, read_minutes, status draft|published, source human|ai, views, created_at, updated_at, published_at)`, `bookmarks(user_id, article_id pk pair)`, `questions(id, user_id, title, domain, difficulty, context, code, code_lang, companies json, urgency, status pending|drafted|rejected, article_id, created_at)`, `visits(id uuid, ip, path, article_id, user_id, referrer, seconds, scroll_pct, created_at)`, `ip_geo(ip pk, status, country, country_code, region, region_name, city, zip, lat, lon, timezone, isp, org, as_name, fetched_at)`, `agent_tasks(id, goal, status queued|running|paused|done|failed, log, article_id, created_at, updated_at)`.

- [ ] Generate migration (`npx drizzle-kit generate`), apply locally (`npx wrangler d1 migrations apply knowstack --local`), load seed (`npx wrangler d1 execute knowstack --local --file seed/seed.sql`). Expected: `select count(*) from articles` > 0.

### Task 2: Auth (TDD)

**Files:** `worker/auth.ts`, `worker/routes/auth.ts`, test `worker/auth.test.ts`.
**Produces:** `hashPassword(pw): Promise<string>`, `verifyPassword(pw, stored): Promise<boolean>`, middleware `sessionUser` (sets `c.var.user: {id,email,name,isAdmin} | null`), `requireUser`, `requireAdmin`. Routes `POST /api/auth/register|login|logout`, `GET /api/auth/me`.

- [ ] Test: roundtrip verifies true; wrong password false; two hashes of same pw differ. Run `npx vitest run worker/auth.test.ts` → fail, implement, pass.

### Task 3: IP geo tracking (TDD)

**Files:** `worker/geo.ts`, `worker/routes/track.ts`, test `worker/geo.test.ts`.
**Produces:** `isPublicIp(ip): boolean`, `fetchGeo(ip, fetcher=fetch): Promise<GeoRow | null>` (null on non-2xx/network error; status `fail` rows are returned so reserved ranges get cached), `POST /api/track {path, articleSlug?, referrer?} → {id}`, `POST /api/track/:id/end {seconds, scrollPct}` (clamped 0–86400 / 0–100).

- [ ] Test: sample response from the user (`24.48.0.1`, Montreal) maps to row with `country:'Canada'`, `countryCode:'CA'`, `city:'Montreal'`, `asName:'AS5769 Videotron Ltee'`; `isPublicIp` false for `127.0.0.1`, `::1`, `10.0.0.1`, `192.168.1.1`, `172.16.0.1`, true for `24.48.0.1`; 429 → `null`; thrown fetch → `null`.

### Task 4: Content API

**Files:** `worker/routes/articles.ts`, `worker/routes/questions.ts`, `worker/routes/admin.ts`, `worker/routes/agent.ts`, `worker/index.ts`.
- Public: `GET /api/categories`, `GET /api/articles?q&category&difficulty&tag&sort=popular|recent&bookmarked=1`, `GET /api/articles/:slug`, `POST|DELETE /api/articles/:slug/bookmark`, `POST /api/questions` (user), `GET /api/questions/similar?q`, `GET /api/stats` (library hero counts).
- Admin: questions list/status, articles CRUD + publish, `POST /api/admin/ai/draft` (Workers AI binding `AI`, 503 if unavailable), `GET /api/admin/analytics?days=30`, agent tasks list/create/status.
- Agent (Bearer `AGENT_TOKEN`): `POST /api/agent/tasks/claim`, `POST /api/agent/tasks/:id/log`, `POST /api/agent/tasks/:id/complete {title, bodyMd, ...}` → creates draft article.

### Task 5: Frontend shell + Library + auth modal + Article + Ask

**Files:** `src/main.tsx`, `src/App.tsx`, `src/index.css` (Tailwind `@theme` with DevVault tokens copied from mockup config), `src/api.ts`, `src/useTrack.ts`, `src/components/{Shell,AuthModal,Markdown,Badge}.tsx`, `src/pages/{Library,Article,Ask}.tsx`.

### Task 6: Admin screens

**Files:** `src/pages/admin/{Questions,Editor,Analytics,Agents}.tsx`.

### Task 7: Verify

- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx vite build`.
- [ ] Run `npx vite dev`, smoke API with curl (register → login → track → admin analytics), screenshot each route with Playwright.
