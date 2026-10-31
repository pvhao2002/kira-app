# KnowStack

Developer knowledge library & interview-prep vault — Hono + React + TypeScript + Drizzle ORM + Cloudflare D1.

| Route | Screen |
|---|---|
| `/`, `/tracks/:category` | Knowledge library (search, tags, category, seniority, bookmarks) + sign-in modal |
| `/articles/:slug` | Article detail (TOC, callouts, Mermaid, bookmark, listen, export) |
| `/ask` | Submit a question (similar-topic search, local drafts) |
| `/admin/questions` | Question queue → draft article |
| `/admin/editor[/:id]` | AI article editor (Workers AI drafts, split preview, publish) |
| `/admin/analytics` | Traffic, engagement and visitor geography (ip-api.com) |
| `/admin/agents` | Agent studio: goals for an external computer-use agent |

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # set ADMIN_EMAILS and AGENT_TOKEN
npm run db:migrate:local
node seed/build.mjs && npm run db:seed:local
npm run dev                            # http://localhost:5173
```

Admins are created from the CLI (public sign-up refuses `ADMIN_EMAILS` addresses, since emails aren't verified):

```bash
ADMIN_PASSWORD='at-least-12-chars' node scripts/create-admin.ts admin@example.com "Admin Name"   # add --remote for prod
```

Running it for an existing account resets its password, so it also reclaims an address someone registered before it
was added to `ADMIN_EMAILS`. Workers AI only works remotely:
`npx wrangler login`, then `CF_REMOTE=1 npm run dev`.

## Deploy

```bash
npx wrangler d1 create knowstack       # put the id into wrangler.jsonc
npx wrangler d1 migrations apply knowstack --remote
npx wrangler d1 execute knowstack --remote --file seed/seed.sql
npx wrangler secret put AGENT_TOKEN
npm run deploy
```

Set `ADMIN_EMAILS` under `vars` in `wrangler.jsonc` (or as a secret).

## Visitor analytics

Each route change posts `/api/track`. The worker reads `CF-Connecting-IP`, stores the visit, and — in `waitUntil`, never
blocking the response — looks the IP up at `http://ip-api.com/json/{ip}` once, caching it in `ip_geo` for 30 days.
Private/loopback IPs are skipped; rate-limit or network failures are not cached, so they retry on a later visit.
Article pages also send read time and scroll depth via `sendBeacon`.
