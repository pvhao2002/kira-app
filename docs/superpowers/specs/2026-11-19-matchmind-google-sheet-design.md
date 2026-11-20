# MatchMind Google Sheet fallback — design

Date: 2026-11-19. Approved in chat: "ok, làm theo cách đó, đồng thời chỉnh lại prompt kêu AI đưa kết quả lên gg sheet
online". Choices: one fixed sheet that agents append to; the sheet link is filled in from `.env`.

## Goal
Some chat agents (e.g. Meta AI) cannot call the MatchMind API from their sandbox but can write to Google Sheets. They
append each request they could not send as one row of one fixed Google Sheet. An Apps Script bound to that sheet sends
new rows to the MatchMind external API every 5 minutes and writes the outcome into the row.

## Fallback order (AI_PREDICTION, AI_SETTLEMENT)
API call → Google Sheet → MatchMind artifact → `CANNOT_CALL_API`. The sheet step applies only when the prompt's
`Google Sheet:` line shows a docs.google.com link and the agent can write to Google Sheets. The agent then replies
`QUEUED_IN_SHEET`.

## Sheet contract
Tab `MatchMind`, row 1 is the header, one request per row. Columns in this order:
`label, path, provider, model, modelVersion, body, status`.
- `provider`, `model`, `modelVersion`: the `X-Provider`, `X-Model-Name`, `X-Model-Version` values (settle: provider
  only).
- `body`: the request JSON on one line. `status`: left empty by the agent, written by the script.

## Prompt link
Stored prompts carry `Google Sheet: {{MATCHMIND_SHEET_URL}}`. New config `app.matchmind-sheet-url`
(`MATCHMIND_SHEET_URL`, default empty). `GET /api/v1/prompts/{id}/for-agent` (admin) replaces that placeholder with it,
like `{{EXTERNAL_API_KEY}}`. Unset means an empty line, so agents skip the sheet. The prompt edits ship as a new V13
migration (V12 untouched), guarded by the V12 text so admin edits survive.

## Script (`MatchMind/docs/google-sheet/MatchMind.gs`)
- `setup()`: adds the MatchMind tab and header row, installs one 5-minute trigger for `sendPending`.
- `onOpen()` menu: **Send now**, **Test connection** (public ping).
- `sendPending()`:
  - LockService prevents overlapping runs.
  - The key comes from Script Property `MATCHMIND_API_KEY`; a missing key is an error.
  - Skips rows with an empty body, and rows whose status starts with `sent` or `rejected`.
  - POSTs to the fixed base `https://match.kira.id.vn` plus the path, only when the path matches
    `^/api/v1/external/[a-z/]+$`, and never follows redirects.
  - Writes and flushes each row's status.
  - Stops after 4 minutes (a run may last 6).
- Outcomes:
  - 2xx: `sent <code>`, with `(already received)` on a duplicate.
  - 401, 408, 429, 5xx, unreachable: `retry …`. The run stops and the next run resends the row.
  - Any other code, or a bad path: `rejected …`. The row is never resent; clear the cell to resend it.
- Resending is safe:
  - Predictions without an `eventId` are deduplicated by payload hash.
  - Settlement never overwrites a settled pick.

## Security
The spreadsheet and its script hold the agent key, so keep the spreadsheet private to its owner. Anyone who can edit
it can read Script Properties, change the script, and add rows that are sent with the key. The fixed API base and the
path check stop a row from sending the key to another host.

## Tests
- `PromptTemplatesIT`:
  - the stored prompt keeps the placeholder and the admin copy fills it;
  - the sheet step comes before the artifact;
  - the prompt's column list equals the script's `COLUMNS`.
- `MatchMind.test.mjs` (`node --test`, fake Google services):
  - sent and skipped rows, and the headers sent;
  - a bad path is never fetched;
  - a rejected row lets the run go on; a retry stops it;
  - unreachable server; missing key.

## Docs
- Update `README.md` (Prompt Notes and config) and `API_DOCUMENTATION.md` (fallback and for-agent).
- Add the variable to `.env.example` and to the API environment in `docker-compose.yml`.
- Out of scope: a web UI note about the second placeholder.
