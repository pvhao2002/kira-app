# KnowStack review fixes

> Executed inline (superpowers:executing-plans). Spec: the 12 findings of the ponytail review on 2026-10-31; user asked to fix all.

**Goal:** Fix every finding without changing the API contract except where a finding requires it.
**Architecture:** Route tests run the real Hono app against a local D1 + rate limiter from Miniflare (already installed with wrangler) — no new dependency.

## Global constraints
- Rate limiting uses Workers `ratelimits` bindings (`period` must be 10 or 60).
- No schema migration in this change.
- Impact: graph rates `readMinutes` / `Difficulty` CRITICAL via unrelated name collisions; text search shows no importer outside `know-stack`. Real callers: `worker/index.ts`, `routes/admin.ts`, `routes/agent.ts`.

## Tasks (test first, each RED → GREEN)
1. **Test harness** — `worker/test-app.ts`: Miniflare D1 + limiter bindings, migrations applied, `call()` helper with cookies/Origin.
2. **#1 seed idempotent** — `seed/build.mjs` exports `seedStatements()`; `INSERT OR IGNORE`, no `DELETE`. Test: seed twice keeps a real article, no duplicates.
3. **#2 login limit** — `LOGIN_LIMITER` (5/60s, key ip+email) → 429; dummy `verifyPassword` for unknown email. Test: 6th failure → 429.
4. **#9 register race** — `onConflictDoNothing().returning()` → 409. Test: two concurrent registers → one 200, one 409.
5. **#3 drafts** — bookmark lookup requires `published`; `/questions/mine` returns `articleSlug` only when published. Tests.
6. **#4 track** — `TRACK_LIMITER` (60/60s per IP) → 429; `views` +1 only if no visit from same IP+article in 30 min. Test.
7. **#5 authz + agent** — tests: anon 401 / user 403 on `/api/admin/*`; complete paused task → 409; concurrent completes → one article.
8. **#6 question draft race** — conditional update claims the question first. Test: two concurrent drafts → one article.
9. **#7 CSV** — `src/csv.ts` `csvCell()` prefixes `'` for `= + - @ \t \r`. Test.
10. **#8 bookmark errors** — catch in Library/Article; 401 → `openAuth()`. Browser check.
11. **#10/#11 lean** — `nowSec`, `readMinutes`, `slugify` in dependency-free `worker/text.ts` (used by worker, editor, seed); `src/types.ts` imports `Difficulty` from schema.
12. **#12 search** — keep `lower()` (content is English) with a `shortcut:` comment naming the limit and upgrade path.

Verify: `npx vitest run`, `npx tsc -b`, `npx vite build`, browser check of bookmarks, GitNexus `detect_changes`.
