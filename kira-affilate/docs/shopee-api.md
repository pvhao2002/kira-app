# Shopee Affiliate Open API — what this module uses and what is confirmed

Endpoint: `POST https://open-api.affiliate.shopee.vn/graphql` (config `shopee.endpoint`).
Official docs: <https://affiliate.shopee.vn/open_api> — **behind a Shopee affiliate login**, so they could not be
read while building this module. Everything marked *mirror* comes from third-party copies of those docs and must be
treated as unconfirmed until `ShopeeLiveIT` passes with real credentials.

## Confidence
| Item | Status |
|---|---|
| Endpoint exists, GraphQL, error envelope `errors[0].extensions.code` | **Confirmed live** (unsigned call → 10020; signed call with an unknown AppID → 10035) |
| Header `SHA256 Credential={AppId}, Timestamp={unix s}, Signature=sha256(AppId+Timestamp+body+Secret)` | Format accepted live (10035, not 10020 "Invalid Authorization Header"); the signature itself is only proven by a real AppID/Secret |
| `generateShortLink(input:{originUrl, subIds ≤5}) → shortLink` | mirror |
| `productOfferV2`, `shopOfferV2`, `shopeeOfferV2` and the fields requested | mirror (`shopeeOfferV2` fields are the least certain) |
| `conversionReport` fields, `scrollId` paging (≤500/page, cursor valid 30 s, >30 s between fresh queries) | mirror |
| `validatedReport(validationId)` | mirror |
| Rate limit (~2000 calls/hour) | mirror, Brazil docs only |
| Sub ID character set | unknown → the app restricts to `[A-Za-z0-9]{1,50}` |
| `utmContent` = sub IDs joined with `-` | assumption; campaign attribution depends on it |
| Short-link input (`s.shopee.vn`, `shope.ee`) accepted as `originUrl` | unknown; the app allows them and shows Shopee's error if rejected |

## Not available from Shopee (so not in the app)
- **Click counts / CTR / click-based conversion rate** — no query exposes them; only a per-conversion `clickTime`.
- **A "paid" status** — `orderStatus` is `UNPAID | PENDING | COMPLETED | CANCELLED`. The closest signal is the
  validated report for a billing `validationId` (found under Billing in the Shopee portal), which the user imports.
- **Batch link generation, product feeds, campaign management** — not confirmed for Vietnam; not called.
- **Per-link performance** — conversions carry Sub IDs (`utmContent`), not the short link.

## Access
Open API access is granted by Shopee per affiliate account. Error **10035** = no access: request it via the form
linked from the portal. 10020 = bad AppID/Secret/signature/clock. 10030 = rate limited. 10031–10034 = account
denied/frozen/blacklisted. 11000–11002 = business/parameter errors.

## Error handling in the client
Timeouts (connect 5 s, read 20 s), up to 3 attempts with linear backoff on I/O errors and HTTP 5xx only; GraphQL
errors are never retried. A rate-limit answer stops the current sync run (`RATE_LIMITED`) or bulk conversion.
Bodies and secrets are never logged.

## First thing to do with real credentials
```
cd kira-affilate-service
SHOPEE_APP_ID=… SHOPEE_SECRET=… JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q verify -Dit.test=ShopeeLiveIT
```
A failure names the query or field Shopee rejected; fix it in `ShopeeAffiliateClient` (and `ConversionMapper`) and
update the table above.
