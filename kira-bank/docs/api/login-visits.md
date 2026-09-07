# Login page visitor tracking

Admin page: `/app/admin/login-visits`, available in the Admin sidebar and global page search.

## Data and definitions

The login page sends one anonymous event when its Angular component is created. The first visit in a document uses the browser Navigation Timing type: `navigate`, `reload` or `back_forward`. Subsequent client-side returns to login use `spa`. A restored login page from the browser back-forward cache emits `back_forward` from `pageshow`.

Each event stores server receipt time, normalized IPv4/IPv6, immediate network peer, IP source, anonymous browser and tab-session IDs, navigation type, request User-Agent (up to 512 characters), browser language/timezone, viewport dimensions and referring **origin only**. It does not record login form fields, email, password, authorization tokens, referrer path/query/fragment, or a user's identity. Browser/OS labels in the Admin page are best-effort User-Agent parsing; the raw User-Agent is available in details.

Views include reloads; a reload is a browser-reported page reload, not a login attempt. One view can be a reload or another navigation type. The report counts views/reloads per IP, distinct browser/tab IDs, first/last receipt times and overall totals. Selecting an IP opens paginated events with complete stored metadata. Filters use exact canonical IP matching and date ranges of at most 91 days. The UI interprets date boundaries in the admin's browser timezone, sends UTC instants, and displays times in that same browser timezone. The API uses an inclusive `from` and exclusive `to`. Every count and first/last timestamp applies to the chosen range.

IDs persist in localStorage (browser) and sessionStorage (tab). They are not unique people: private browsing, blocked/cleared storage, shared IPs and duplicated tabs affect the counts. No retroactive history exists before this feature is deployed. Blocked JavaScript/requests, offline visits, requests interrupted before delivery, and traffic exceeding the endpoint limit may be absent. Client navigation and device metadata can be spoofed. The module does not claim geolocation or identity attribution.

Tracking uses a small keepalive fetch without credentials, does not await it, and suppresses analytics failures so login remains usable. The tracking endpoint deduplicates UUID event IDs and accepts at most 300 events/minute/IP per application instance, with bounded in-memory rate-limit state. Configure edge protection for public deployments as appropriate; this is browser analytics rather than a complete network/security access log.

## Endpoints and storage

- `POST /api/v1/public/login-visits`: anonymous JSON event; returns 204, invalid input 400, rate limit 429. No login/authentication data is accepted.
- `GET /api/v1/admin/login-visits?from=...&to=...&ip=...&page=0&size=25`: Admin-only totals and paginated IP summaries.
- `GET /api/v1/admin/login-visits/events?...`: Admin-only paginated events; same filters.

Admin protection is enforced in the backend URL authorization, controller method authorization, frontend route guard and menu visibility. Page size is bounded at 100. Filters are SQL parameters. Report queries run in read-only transactions so totals and rows share the database transaction snapshot.

Migration `V25__create_login_visits.sql` creates the table and time/IP indexes. An hourly cleanup removes up to 10,000 records older than 90 days per run, so large backlogs may temporarily remain longer. No runtime migration or historical backfill is performed by a compile check.

## Correct IP attribution behind proxies

The default trusts loopback proxies only. The development API proxy appends forwarding information with `xfwd: true`. In Docker/production, set **`LOGIN_VISIT_TRUSTED_PROXIES`** to the specific address/CIDR of your UI reverse proxy and any additional controlled proxy hops. Both Compose files pass this variable into the backend. Never use `0.0.0.0/0` or `::/0` as a shortcut. The report displays the immediate peer to help identify the proxy whose actual address must be configured.

The existing UI Nginx appends its observed remote address to `X-Forwarded-For`. The backend starts at the connection peer, walks the header from right to left only while the current hop is trusted, and stops at the first untrusted address. It ignores forwarded headers sent directly from an untrusted peer. Malformed chains fall back to the connection address. It does not blindly trust the first header value or `CF-Connecting-IP`.

If Cloudflare or another load balancer precedes Nginx, configure its real proxy ranges based on the actual deployment and ensure the origin cannot be bypassed. Without this deployment-specific configuration, the recorded IP will correctly be the proxy/connection address, not an assumed client address. The resolver requires the original servlet connection peer; do not enable a separate blanket forwarded-header rewriting filter in front of it.

## Verification

Backend compile is the repository-required check. Angular builds and automated tests are not run under the repository instructions. Deployment checks: open login, reload twice, then check the Admin report for three views/two reloads; navigate away/back to distinguish SPA navigation; inspect event metadata; confirm non-Admin API access is rejected; compare the connected peer and resolved IP through the actual proxy chain.

Manual local verification on 2026-09-07 after backend restart: the Admin report loaded successfully from the running database; opening login once and reloading twice produced exactly 3 views and 2 reloads, one browser ID and one tab-session ID. Event details displayed the two reloads and initial navigation, server times, loopback IPv6, User-Agent, language, timezone, dimensions and IDs. Filtering an absent IP returned an empty report; filtering `::1` matched its canonical IPv6 representation and restored the 3/2 totals. Anonymous access to the Admin report returned HTTP 403. The dark-theme page was visually inspected in the browser. Production proxy attribution, authenticated non-Admin access, retention scheduling, back-forward-cache and SPA navigation were not exercised in this local check.
