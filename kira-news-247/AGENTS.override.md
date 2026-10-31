# kira-news-247 — module rules

Vietnamese news site whose articles are drafted daily by an AI agent (ChatGPT Codex using computer use) and approved
by the owner. Two apps share one protobuf contract:

- `proto/kira/news/v1/news.proto` — the only API contract. BE ↔ FE payloads are `application/x-protobuf`; never add a
  JSON endpoint for this API (crawler files `sitemap.xml`/`rss.xml`/`robots.txt` are the only non-protobuf responses).
- `kira-news-247-service` — Java 25, Spring Boot 3.5, Oracle (Autonomous Database in prod), Flyway, session auth.
- `kira-news-247-ui` — Angular 21 SSR (zoneless, Signals, `httpResource`, RxJS), Tailwind v4 + spartan-ng (shadcn/ui)
  helm components copied into `src/app/ui`.

## Change rules

- A contract change edits `news.proto`, then regenerates both sides in the same task:
  `npm run gen:proto` in the UI (commits `src/app/gen`), Maven regenerates Java on compile. Field numbers are never reused.
- Schema changes are new Flyway files `V<n>__*.sql` (Oracle syntax). Never edit an applied migration.
- The review workflow lives in `ArticleWorkflow` (pure, unit-tested). The EDITOR (AI) role must never publish, edit
  in IN_REVIEW, or read analytics; keep that enforced server-side.
- Admin UI controls keep their `data-testid` values: the AI agent's playbook depends on them.
- Public routes must stay server-rendered with title/description/canonical/JSON-LD; read `.data()` (not `.value()`)
  from `protoResource` so an API error never throws during SSR; pages whose existence decides the HTTP status load
  through a resolver (see `public/resolvers.ts`).
- Read tracking (ipinfo.io) runs in the browser only and must never block or break reading.

## Verification

- Service (macOS): `cd kira-news-247-service && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q test -Dtest='ArticleWorkflowTest,ArticleDraftsTest,SlugsTest,MarkdownTest'`
- Full loop on real Oracle (Docker): `... mvn test -Dtest=NewsFlowIT`
- UI: `cd kira-news-247-ui && npx ng test --watch=false --include=src/app/admin/front-matter.spec.ts` and `npx ng build`.
