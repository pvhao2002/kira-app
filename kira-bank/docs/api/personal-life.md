# Personal life records

The authenticated user can keep private karaoke references and job opportunities in Kira Life. Both modules are available from the web sidebar and the mobile **Cá nhân** screen. Every record is owner-scoped and uses optimistic locking through `version`.

## Favorite karaoke songs

Base path: `/api/v1/karaoke/favorite-songs`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List songs with optional `search`, `page` and `size` |
| GET | `/{id}` | Read one owned song |
| POST | `/` | Create a song |
| PUT | `/{id}` | Replace a song with `version` |
| DELETE | `/{id}?version=N` | Soft-delete a song with optimistic locking |

Create/update fields are `title`, `artist`, `genre`, `karaokeCode`, `tone`, `link` and `note`. `title` is required. Links, when supplied, must use HTTP or HTTPS. List responses use `{ data, meta }`; a record response includes `id`, timestamps and `version`.

## Job tracker

Base path: `/api/v1/jobs`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List opportunities with optional `search`, `page` and `size` |
| GET | `/{id}` | Read one owned opportunity |
| POST | `/` | Add an opportunity to the tracker |
| PUT | `/{id}` | Replace an opportunity with `version` |
| DELETE | `/{id}?version=N` | Soft-delete an opportunity with optimistic locking |

Fields are `companyName`, `positionTitle`, `location`, `jobUrl`, `salary`, `employmentType`, `status`, `priority`, `deadline`, `contactName`, `contactEmail` and `notes`. `companyName` and `positionTitle` are required. Status is one of `SAVED`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED` or `WITHDRAWN`; priority is `LOW`, `MEDIUM` or `HIGH`. Job links must use HTTP or HTTPS.

Migration `V31__create_karaoke_and_job_tracker.sql` creates the two tables with user ownership, audit timestamps, soft-delete markers and indexes for search/list ordering. These records do not write to credit-card, investment or ledger domains.
