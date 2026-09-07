# Travel (web)

Open **Travel / Du lịch** in the sidebar or the overview shortcut at `/app/travel`.
This module uses the existing web authentication and has no native/mobile implementation.

## Features

- Create, edit, search and delete trips with destination, departure/return dates, IANA timezone, budget, notes and companions.
- A departure countdown uses the trip's local calendar date and refreshes every 30 seconds. Departure day, ongoing trips and completed trips have separate labels.
- Daily itinerary with optional times, locations and notes. Activities must fall within the trip dates; maximum trip duration is 730 nights.
- Packing items with categories, quantities and saved completion status.
- Expenses with a payer and a selected subset of companions. Each expense is divided equally among those companions. The server returns paid/share/net amounts and suggested repayments.
- Booking records with type, date, reference code, optional HTTP(S) link and notes; private PDF/PNG/JPEG uploads in a trip-level document library.
- Saved places with coordinates, address, notes and visited status. Select a place to display its pin in an OpenStreetMap embed; directions open Google Maps. Requires an internet connection; coordinates are entered manually. No geocoding API key is required.
- English/Vietnamese labels, theme-aware styling, loading/error/empty states, draft protection on navigation, and conflict handling.

## Ownership and persistence

Migration `V24__create_travel_module.sql` creates `travel_trips` and `travel_files`.
Trip data is a validated JSON aggregate. Every operation derives its owner from the authenticated principal. Companion names are bookkeeping entries inside a private trip, not invited users or shared accounts.

Updates and trip deletion require an optimistic `version`. A new trip uses `version: -1`; a persisted trip starts at `0`. Stale writes return `409 TRAVEL_VERSION_CONFLICT`. The UI retains the draft after a failed save and asks the user to reload before editing again; it does not silently overwrite a newer version.

Files are stored in MySQL as private BLOBs, independent of R2 configuration. The file list and bytes have separate owner-scoped endpoints. Limits: 20 files per trip, 5 MiB per file, PDF/PNG/JPEG signatures only. The server sanitizes filenames and determines their extension from the signature. Downloads require authentication and use `attachment`, `nosniff` and `Cache-Control: no-store`. Signature checking is not malware scanning. Trip deletion removes its files in the same database transaction via cascading foreign key. File changes lock the trip row but do not modify the trip document version.

## Currency rules

One currency per trip: VND, USD, EUR, JPY, THB, GBP or SGD. VND/JPY amounts use whole units; the other supported currencies use two decimal places. Currency cannot change while persisted expenses exist. Delete the expenses and save before changing it. Budget and total expenses are capped at 1,000,000,000,000 currency units.

The server calculates in integer minor units. A split remainder is allocated in stable companion-ID order. For example, VND 100 divided among three companions becomes 34 + 33 + 33. Total paid equals total shares, and net balances sum to zero. A payer need not participate in the expense. A companion used in an expense cannot be removed without first editing/removing that expense.

Repayment suggestions are calculated balances only. This version does not transfer money, track repayment completion, exchange currencies or sync expenses into the investment/credit-card modules.

## API

All paths below are relative to `/api/v1/travel/trips` and require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Owner's trips with computed balances and repayments |
| POST | `/` | Create with `{data, version: -1}` |
| GET | `/{id}` | Read one owned trip |
| PUT | `/{id}` | Replace trip data with `{data, version}` |
| DELETE | `/{id}?version=N` | Delete trip and all its files |
| GET | `/{id}/files` | List document metadata |
| POST | `/{id}/files` | Upload multipart field `file` |
| GET | `/{id}/files/{fileId}` | Authenticated binary download |
| DELETE | `/{id}/files/{fileId}` | Delete one document |

`data` contains `name`, `destination`, `startDate`, `endDate`, `timezone`, `currency`, `budget`, `notes`, `members`, `activities`, `packing`, `expenses`, `bookings`, and `places`. Child records have stable IDs. List limits: 50 companions, 500 activities, 500 packing items, 1,000 expenses, 200 bookings, and 300 places. Dates use ISO `YYYY-MM-DD`, itinerary time is optional `HH:mm` in the trip timezone. Booking and expense dates may precede the trip (for advance purchases).

Responses include `{id, data, version, summary: {total, balances, transfers}}`. Balances contain `{memberId, paid, share, net}`; transfers contain `{from, to, amount}`. Missing or another owner's IDs return 404. Invalid data returns 400.

## Verification

Backend compilation is the required repository check. Tests and Angular builds were not run, per repository instructions. Live migration, browser flows, map loading and upload/download against a running database still require runtime verification.
