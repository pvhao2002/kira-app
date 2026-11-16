# kira-affilate — module rules

Scope: `kira-affilate/` only (Shopee Affiliate platform for Vietnamese users). The module name is spelled
`kira-affilate` on purpose; the Java package is `com.kira.affiliate`.

- `kira-affilate-service` — Java 25, Spring Boot 3.5, MySQL 8, Flyway. Package per capability
  (`identity`, `shopee`, `link`, `order`, `report`, `shared`).
- `kira-affilate-ui` — Angular 22 standalone + signals, Tailwind v4, Chart.js, Vietnamese only.
- Contract between them: `docs/api.md`. Change the service, the UI models and that file together.

## Rules
- **Every query is scoped by the authenticated user id** (`@AuthenticationPrincipal Long userId` → `WHERE user_id = :userId`).
  A new table needs a `user_id` column and a case in `AffiliateFlowIT` proving user B cannot read user A's rows.
- **Only documented Shopee operations**, all in `ShopeeAffiliateClient`. Never invent a query or field. A new one
  needs a case in `ShopeeLiveIT` and an entry in `docs/shopee-api.md`. The endpoint comes from config, never from input.
- Never fake Shopee data: no demo numbers, no simulated success. Shopee has no click counts and no "paid" status —
  the UI says so instead of estimating.
- Shopee secrets are stored only through `CredentialCipher` and are never returned by any endpoint or logged.
  Never log tokens, secrets, cookies or Shopee response bodies.
- Sync writes go through `ConversionStore` upserts (unique keys = idempotent). No Shopee or bulk DB work on a
  request or scheduler thread.
- Money is `BigDecimal` / `DECIMAL(18,2)`. Times are stored UTC, shown in `Asia/Ho_Chi_Minh`.
- Schema changes are new `V<n>__*.sql` files; never edit an applied migration. Check the highest number first.
- Tax and legal content lives in `kira-affilate-ui/src/app/content/`. Every entry cites its source document and
  carries `verified`; set `verified: true` only after reading the primary text. Never write a rate from memory.

## Verify (macOS)
- Service: `cd kira-affilate/kira-affilate-service && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q verify`
  (unit + Testcontainers ITs; Docker must be running). Live Shopee check: export `SHOPEE_APP_ID`/`SHOPEE_SECRET` first.
- UI: `cd kira-affilate/kira-affilate-ui && npx ng test --watch=false && npx ng build`
