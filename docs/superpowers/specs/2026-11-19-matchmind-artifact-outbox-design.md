# MatchMind artifact outbox — design

Date: 2026-11-19. Size: medium change (one security config change, one migration, tests, docs). Status: approach A
picked in chat; this document awaits approval.

## Intent

AI chat agents run in sandboxes that block outbound requests, so their calls to the MatchMind external API fail.
Instead of printing JSON for a manual paste, the agent keeps every request it could not send in a "MatchMind" artifact
in the chat. The user opens the artifact and presses Send per request, or Send all, and the browser delivers them to
`https://match.kira.id.vn`.

## Approaches

- **A (picked): the artifact calls the external API from the browser.** Open CORS on `/api/v1/external/**`. The API
  key sits in the artifact (masked input). The platform must also let the artifact reach the domain (Claude may ask
  the user to allow it; ChatGPT canvas needs network access on).
- B: the artifact opens the MatchMind Import page with the payloads in the URL fragment, and the logged-in admin
  imports them. No key in the artifact and no CORS change, but it needs Import page changes and a new settle import
  API. Not picked.
- C: prompts only. The server's CORS rejects the artifact origin and the `X-Api-Key` header, so Send cannot work.
  Rejected.

## Design

1. **CORS** (`SecurityConfig.corsConfigurationSource`): register `/api/v1/external/**` before `/api/v1/**`. Settings:
   - any origin (`*`), methods `GET`, `POST`;
   - headers `Content-Type`, `X-Api-Key`, `X-Provider`, `X-Model-Name`, `X-Model-Version`, `X-Request-Id`;
   - no credentials; exposed `X-Correlation-ID`, `Retry-After`.

   The key travels in a header, never a cookie, so a foreign page cannot act with it: CSRF does not apply. The
   dashboard API (`/api/v1/**`) keeps its exact-origin list.
2. **Migration `V12__prompts_matchmind_artifact.sql`**:
   - **New template.** `INSERT` "MatchMind Artifact Prompt", type `AI_ARTIFACT`, with `ON CONFLICT (name) DO NOTHING`.
     It holds the rules plus a complete single-file HTML page that the agent copies character for character. The page:
     - has the base URL `https://match.kira.id.vn` and a masked key input prefilled with `{{EXTERNAL_API_KEY}}`
       (the admin Copy fills it in; a copy that still holds the placeholder leaves the field empty for the user);
     - holds a `QUEUE` array of `{label, path, headers, body}` items;
     - shows a table with a status per item, plus Send and Copy JSON buttons (Copy JSON selects the text for Ctrl+C
       when the sandbox blocks the clipboard);
     - has Send all, which sends in order, skips items already sent, and stops on 401 or when a request cannot reach
       the server, since the rest would fail the same way;
     - has Test connection, which calls the public `GET /api/v1/external/ping`;
     - uses vanilla JS only, with no external resources and no storage.

     Rules for the agent: one artifact per conversation; append to `QUEUE`, never drop items; do not publish the
     artifact (it holds the key); reply `QUEUED_IN_ARTIFACT <n>`.
   - **`AI_PREDICTION`.** Replace the V11 "cannot reach the server" paragraph: put the request in the MatchMind
     artifact (append if it exists, else create it from the artifact prompt, asking the user for that prompt if it was
     not given). The item shape is shown (`path` `/api/v1/external/predictions`, headers `X-Provider`, `X-Model-Name`,
     `X-Model-Version`). Agents that cannot create artifacts keep the existing `CANNOT_CALL_API` + JSON fallback for
     Import prediction.
   - **`AI_SETTLEMENT`.** Same, with `path` `/api/v1/external/predictions/settle` and header `X-Provider`. The
     existing `CANNOT_CALL_API` + curl fallback stays for agents without artifacts.
   - Both updates only run while the old default text is present, so admin edits are kept (as in V8-V11).
     Each update bumps `version`.
3. **Docs:** `API_DOCUMENTATION.md` gets the CORS rule for external endpoints and the new template. `README.md` names
   the new prompt.

My calls (correct me if wrong): template and artifact UI in English, like the existing DELIVERY sections and the web
UI; key prefilled rather than typed each time; the CANNOT_CALL_API fallback kept as a last resort; no "sent" state
persisted in the artifact (re-sending is safe: a duplicate prediction returns 200, and settle never overwrites a
settled pick).

## Non-goals

No web UI change, no new endpoint, no change to the external API's auth, rate limits or audit, no React variant.

## Constraints

- The platform's sandbox must allow `match.kira.id.vn`. This is outside our control, so the artifact keeps Copy JSON
  (Import prediction) as the escape hatch.
- Prompt migrations replace exact text, so `*.sql` stays LF (`.gitattributes`).
- In production, prompts an admin already edited are not changed. Check them on the Prompt Notes page after deploy.
- The TLS host proxy in front of `match.kira.id.vn` is outside this repo. After deploy, check that a preflight to
  `/api/v1/external/predictions` returns the CORS headers.
- nginx answers 429 itself, without CORS headers, so the artifact sees a rate-limited request as unreachable. Send all
  stops and the user retries later.

## Verification

- `ExternalHeadersIT`: a preflight from a foreign origin to `/api/v1/external/predictions` is allowed (`*`, agent
  headers), also from `Origin: null` (sandboxed iframes send it). A real POST from that origin returns 201 with
  `Access-Control-Allow-Origin`. A preflight to `/api/v1/predictions` from that origin is still rejected.
- `PromptTemplatesIT`: the artifact template exists, keeps the key placeholder when stored and gets it filled on admin
  copy. Both prompts name the MatchMind artifact and still contain `CANNOT_CALL_API`.
- Manual browser check: the template's HTML, served from another origin against a locally running API, passes Test
  connection, Send and Send all.
