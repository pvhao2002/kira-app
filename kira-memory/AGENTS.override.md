# kira-memory — module rules

Scope: `kira-memory/` only. A private photo/video memories site for exactly two people (Vietnamese UI).

- `kira-memory-service` — Java 25, Spring Boot 3.5, MySQL 8, Flyway, `JdbcClient` (no JPA). Packages per capability:
  `identity`, `media`, `album`, `message`, `settings`, `storage`, `shared`.
- `kira-memory-ui` — Angular 22 standalone + signals, zoneless, `@angular/cdk` virtual scroll, plain CSS tokens in
  `src/styles.css` (love theme: petal/rose/wine, Dancing Script + Be Vietnam Pro).
- Contract between them: `docs/api.md`. Change the service, `kira-memory-ui/src/app/core/api.ts` and that file together.

## Rules
- Exactly two accounts, seeded by `V1__init.sql`: `admin` (ADMIN) and `love` (VIEWER). There is no registration.
  Everything that changes data except messages and period days (`/api/cycle`, Em logs them herself) lives under
  `/api/admin/**` (ADMIN only).
- Session = signed JWT in the HttpOnly `SameSite=Strict` cookie `km_session`. CSRF tokens are off because of that.
- Media bytes are served only from `/m/{id}/{hmac}/o.{ext}` and `/m/{id}/{hmac}/t.jpg`: cookie-free,
  `Cache-Control: public, max-age=31536000, immutable`, Range passthrough. Never add a `Set-Cookie` or `Vary: Cookie`
  to them, never make their bytes change for an id (a new file is a new media row).
- Storage providers live behind `BlobStore` (`HuggingFaceBlobStore`, `R2BlobStore`). Each media row records its
  provider, so switching the admin setting only affects new uploads. Never log tokens or provider response bodies.
- Times are stored as UTC `DATETIME(3)` through `shared/Utc` (LocalDateTime at the JDBC boundary).
- Schema changes are new `V<n>__*.sql` files; never edit an applied migration.

## Verify (macOS)
- Service: `cd kira-memory/kira-memory-service && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q verify`
  (Testcontainers MySQL + S3Mock + an in-process Hugging Face stub; Docker must be running).
- UI: `cd kira-memory/kira-memory-ui && npx ng test --watch=false && npx ng build`
