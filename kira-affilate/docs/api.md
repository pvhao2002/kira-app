# kira-affilate API contract (v1)

Base path `/api/v1`. JSON. `Authorization: Bearer <accessToken>` on everything except register/login/refresh/logout.
The refresh token is an HttpOnly `SameSite=Strict` cookie (`kaff_refresh`, path `/api/v1/auth`); the UI calls
`POST /auth/refresh` with `withCredentials` on a 401 and at startup.

- Errors: `{timestamp,status,code,message,fieldErrors,path,traceId}` — `message` is Vietnamese and safe to display.
- Pages: `{data:[...], meta:{page,size,totalElements,totalPages}}`; `page` is 0-based, `size` ≤ 100.
- Dates in queries: `from`, `to` = `yyyy-MM-dd`, inclusive, interpreted in `Asia/Ho_Chi_Minh`.
- Timestamps in responses: ISO-8601 instants (UTC). Money: JSON numbers in VND.
- `sort` = `field,asc|desc` from the whitelist listed per endpoint.

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{email,password(8..72),fullName}` | `AuthResponse` + cookie |
| POST | `/auth/login` | `{email,password}` | `AuthResponse` + cookie |
| POST | `/auth/refresh` | – (cookie) | `AuthResponse` + rotated cookie |
| POST | `/auth/logout` | – | 204 |
| GET | `/auth/profile` | – | `Profile` |
| PUT | `/auth/profile` | `{fullName,version}` | `Profile` |
| POST | `/auth/change-password` | `{currentPassword,newPassword}` | 204 (all sessions revoked) |

`AuthResponse = {accessToken, expiresInSeconds, user: Profile}`, `Profile = {id,email,fullName,version}`.

## Shopee credentials & offers
`CredentialStatus = {configured, appId|null, lastCheckedAt|null, lastStatus|null, lastErrorCode|null, lastErrorMessage|null}`
with `lastStatus ∈ OK | INVALID_CREDENTIAL | NO_API_ACCESS | RATE_LIMITED | ERROR`. The secret is never returned.

| Method | Path | Notes |
|---|---|---|
| GET | `/shopee/credentials` | `CredentialStatus` |
| PUT | `/shopee/credentials` | `{appId,secret}` → saved (encrypted), then tested → `CredentialStatus` |
| POST | `/shopee/credentials/test` | → `CredentialStatus` |
| DELETE | `/shopee/credentials` | 204 |
| GET | `/shopee/offers/products?keyword&sortType&page&limit` | live Shopee `productOfferV2` |
| GET | `/shopee/offers/shops?keyword&sortType&page&limit` | live Shopee `shopOfferV2` |
| GET | `/shopee/offers/campaigns?keyword&sortType&page&limit` | live Shopee `shopeeOfferV2` |

Offer pages: `{items:[...], page, limit, hasNextPage}` — here `page` is 1-based (Shopee's), `limit` ≤ 50.
- product item: `{itemId,productName,imageUrl,priceMin,priceMax,sales,ratingStar,commissionRate,commission,shopName,productLink,offerLink}`
- shop item: `{shopId,shopName,imageUrl,commissionRate,ratingStar,originalLink,offerLink,periodStartTime,periodEndTime}`
- campaign item: `{offerName,imageUrl,commissionRate,originalLink,offerLink,periodStartTime,periodEndTime}`

`commissionRate` is a decimal fraction string from Shopee (e.g. `"0.05"` = 5%). Period times are Unix seconds (nullable).
Without working credentials these return 409 `SHOPEE_NOT_CONNECTED`; Shopee failures return 502 `SHOPEE_*` codes.

## Campaigns (the user's own tracking campaigns = named Sub ID sets)
`Campaign = {id,name,subIds:[string ≤5],createdAt}`; each sub ID matches `^[A-Za-z0-9]{1,50}$`.

`GET /campaigns` → `Campaign[]` · `POST /campaigns {name,subIds}` · `PUT /campaigns/{id}` · `DELETE /campaigns/{id}` (204)

## Links
| Method | Path | Notes |
|---|---|---|
| POST | `/links/convert` | `{urls:[1..50], subIds?:[≤5], campaignId?}` → `{results:[{originUrl,status,shortLink,error,id}]}`; `status ∈ OK|FAILED`. `campaignId` and `subIds` are mutually exclusive. |
| GET | `/links?search&status&campaignId&from&to&page&size&sort` | Page of `Link`; sort: `createdAt` |
| GET | `/links/export?…same filters` | `text/csv` (UTF-8 BOM) |
| DELETE | `/links/{id}` | 204 (history row only; the Shopee link keeps working) |

`Link = {id,originUrl,shortLink,subIds:[],campaignId,campaignName,status,error,createdAt}`

## Orders & commissions
`bucket ∈ ESTIMATED | CONFIRMED | REJECTED | VALIDATED` (VALIDATED = present in an imported Shopee validated report).

| Method | Path | Notes |
|---|---|---|
| GET | `/orders?search&orderStatus&bucket&from&to&page&size&sort` | Page of `OrderRow`; sort: `purchaseTime`, `commission`, `actualAmount` |
| GET | `/orders/{id}` | `OrderDetail` |
| GET | `/orders/export?…same filters` | `text/csv` |
| POST | `/sync` | 202 `SyncRun` (409 `SYNC_RUNNING` if one is in flight) |
| GET | `/sync/status` | `{running, lastRun: SyncRun|null, lastSuccessAt|null}` |
| GET | `/sync/runs?page&size` | Page of `SyncRun` |
| POST | `/validations` | `{validationId}` → 202 `SyncRun` |
| GET | `/validations` | `[{validationId, importedAt, conversions, totalCommission}]` |

`OrderRow = {id,conversionId,orderId,itemId,itemName,shopName,imageUrl,qty,itemPrice,actualAmount,refundAmount,
orderStatus,fraudStatus,bucket,commission,purchaseTime,completeTime,utmContent}`

`OrderDetail = OrderRow + {modelId,clickTime,buyerType,device,referrer,itemSellerCommission,itemShopeeCommission,
conversionTotalCommission,conversionNetCommission,validatedAt,validationId,categoryLv1,itemNotes}`

`SyncRun = {id,kind,trigger,status,startedAt,finishedAt,rowsUpserted,errorCode,errorMessage}` with
`kind ∈ CONVERSIONS|VALIDATION`, `trigger ∈ SCHEDULED|MANUAL`, `status ∈ RUNNING|SUCCESS|FAILED|RATE_LIMITED`.

`orderStatus` values come from Shopee: `UNPAID | PENDING | COMPLETED | CANCELLED`.

## Reports
| Method | Path | Returns |
|---|---|---|
| GET | `/reports/summary?from&to` | `{orders,items,gmv,commission:{estimated,confirmed,rejected,validated},links,clicksAvailable:false}` |
| GET | `/reports/timeseries?from&to&granularity=day|week|month` | `[{period:"yyyy-MM-dd",orders,gmv,estimated,confirmed,rejected}]` |
| GET | `/reports/top?from&to&by&limit` | `[{key,label,orders,items,gmv,commission}]` |

`by ∈ product | shop | subId | campaign | status | category | device | buyerType`. `limit` ≤ 100 (default 10).
In the time series, `confirmed` includes validated commission; `gmv` excludes rejected items. In `top`, `gmv` and
`commission` include every status (so `by=status` adds up).
`clicksAvailable` is always `false`: the Shopee Open API does not expose click counts, so click and click-through
conversion metrics are not available. Link-level performance is attributable only through Sub IDs (`by=subId`,
`by=campaign`), because Shopee's conversion report carries `utmContent` (the Sub IDs), not the short link.
