# MatchMind Google Sheet Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents that cannot reach the API but can write to Google Sheets append each unsent request to one fixed
sheet; an Apps Script in that sheet sends the rows to the MatchMind external API.

**Architecture:** A standalone Apps Script file in `MatchMind/docs/google-sheet/` (tested with `node --test` against
fake Google services). A V13 migration adds the sheet step to the two agent prompts, and `PromptController.forAgent`
fills the new `{{MATCHMIND_SHEET_URL}}` placeholder from config.

**Tech Stack:** Google Apps Script (V8), Node 22 `node:test` + `node:vm`, Java 25 / Spring Boot 3.5, Flyway, PostgreSQL 17,
Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-19-matchmind-google-sheet-design.md`

## Global Constraints

- Columns, in this exact order: `label, path, provider, model, modelVersion, body, status`.
- API base `https://match.kira.id.vn`; allowed path regex `^/api/v1/external/[a-z/]+$`.
- Script Property name `MATCHMIND_API_KEY`; tab name `MatchMind`; trigger every 5 minutes; time budget 4 minutes.
- Placeholder `{{MATCHMIND_SHEET_URL}}`; config `app.matchmind-sheet-url: ${MATCHMIND_SHEET_URL:}`.
- Agent reply after a sheet append: `QUEUED_IN_SHEET`.
- New migration `V13__prompts_google_sheet.sql`: LF line endings, no dollar-brace pairs, each UPDATE guarded by
  `position(<V12 text> IN content) > 0`, `version = version + 1, updated_at = now()`. Never edit V12.
- Never log or store the key. Work on master, no commit.

## Review Focus

- The agent splits the JSON body over several cells, or adds line breaks or smart quotes. The API answers 400 and
  the row becomes `rejected` with the API message, so the user sees why.
- The run is killed at Google's 6-minute limit after a POST and before its status is written. The row is resent;
  this is safe because predictions are deduplicated by payload hash and a settled pick is never overwritten.
- The spreadsheet is shared for editing. The key leaks to every editor, so the docs must say to keep it private.
- `MATCHMIND_SHEET_URL` is unset. The admin copy shows an empty `Google Sheet:` line, so agents go on to the artifact.
- The agent appends to another tab or shifts the columns. The script ignores the row or rejects it; the prompt names
  the tab and the column order.

---

### Task 1: Apps Script sender

**Files:**
- Create: `MatchMind/docs/google-sheet/MatchMind.gs`
- Test: `MatchMind/docs/google-sheet/MatchMind.test.mjs`

**Interfaces:**
- Produces: the line `const COLUMNS = ['label', 'path', 'provider', 'model', 'modelVersion', 'body', 'status'];`
  (Task 2's IT pins the prompts to it). Global functions `setup()`, `onOpen()`, `sendPending()`, `testConnection()`.

- [ ] **Step 1: Write the failing test** `MatchMind.test.mjs`. Load the script with `vm.runInNewContext`, using fakes
  for `SpreadsheetApp`, `PropertiesService`, `LockService` and `UrlFetchApp`. Tests:
  - `sends new rows with the agent headers and skips finished ones`:
    - A prediction row answered 201 becomes `sent 201`. Its URL is `https://match.kira.id.vn/api/v1/external/predictions`;
      its headers are `X-Api-Key`, `X-Provider`, `X-Model-Name` and `X-Model-Version`; its payload is the body unchanged.
    - A settle row with no model, answered 200 `{duplicate:true}`, becomes `sent 200 (already received)` and sends no
      `X-Model-Name`.
    - Rows with status `sent 201` or `rejected 400 …` are not fetched.
  - `never sends a row whose path leaves the external API`: the path `@evil.example/x` becomes `rejected…` with no fetch.
  - `rejects client errors, then stops at a wrong key`: 400 becomes `rejected 400 VALIDATION_ERROR: …`; 401 becomes
    `retry 401 …`; the third row is not fetched.
  - `waits for the next run when the server is unreachable`: when `fetch` throws, the status becomes
    `retry: cannot reach https://match.kira.id.vn`.
  - `refuses to run without the key`: `sendPending` throws `/MATCHMIND_API_KEY/`.
- [ ] **Step 2: Run** `node --test MatchMind/docs/google-sheet/MatchMind.test.mjs`.
  Expected: FAIL (ENOENT, `MatchMind.gs` missing).
- [ ] **Step 3: Implement `MatchMind.gs`** per the spec's Script section. The setup steps and the security note go in
  the header comment.
- [ ] **Step 4: Run** the same command. Expected: 5 pass, 0 fail.

### Task 2: Sheet step in the agent prompts

**Files:**
- Create: `MatchMind/matchmind-api/src/main/resources/db/migration/V13__prompts_google_sheet.sql`
- Modify:
  - `MatchMind/matchmind-api/src/main/java/com/matchmind/prompt/PromptController.java` (`forAgent`; impact: UNKNOWN,
    meaning HTTP-only callers: the web `promptForAgent` and the ITs)
  - `MatchMind/matchmind-api/src/main/resources/application.yml`
  - `MatchMind/.env.example`, `MatchMind/docker-compose.yml`, `MatchMind/README.md`, `MatchMind/docs/API_DOCUMENTATION.md`
- Test:
  - Modify `MatchMind/matchmind-api/src/test/java/com/matchmind/it/IntegrationTestBase.java`: add
    `SHEET_URL = "https://docs.google.com/spreadsheets/d/test-sheet/edit"` and register `app.matchmind-sheet-url`.
  - Add a test to `MatchMind/matchmind-api/src/test/java/com/matchmind/it/PromptTemplatesIT.java`.

**Interfaces:**
- Consumes: Task 1's `const COLUMNS = [...]` line in `../docs/google-sheet/MatchMind.gs`, relative to the module
  directory.
- Produces: `PromptController.SHEET_URL_PLACEHOLDER = "{{MATCHMIND_SHEET_URL}}"`.

- [ ] **Step 1: Write the failing test** `bothPromptsTryTheGoogleSheetBeforeTheArtifact`:
  - The script contains `const COLUMNS = ['label', …, 'status'];`.
  - For AI_PREDICTION and AI_SETTLEMENT, the stored prompt contains:
    - `Google Sheet: {{MATCHMIND_SHEET_URL}}`;
    - `Columns in this order: label, path, provider, model, modelVersion, body, status.`;
    - `path: /api/v1/external/predictions\n` (prediction) or `path: /api/v1/external/predictions/settle\n` (settle);
    - `QUEUED_IN_SHEET`.
  - The stored prompt does not contain `SHEET_URL`.
  - `indexOf("Google Sheet: ")` < `indexOf("MatchMind artifact")`.
  - The for-agent copy contains `Google Sheet: ` + `SHEET_URL` and no placeholder.
- [ ] **Step 2: Run** `cd MatchMind/matchmind-api && mvn -B verify -Dit.test=PromptTemplatesIT`.
  Expected: the new test fails on the missing placeholder.
- [ ] **Step 3: Implement.**
  - V13 replaces `do not retry. Put the request in the\nMatchMind artifact instead:` in each prompt with:
    - the sheet paragraph: the `Google Sheet:` line, one bullet per column, then `QUEUED_IN_SHEET`;
    - followed by `Otherwise put the request in the MatchMind artifact:`.
  - `forAgent` chains `.replace(SHEET_URL_PLACEHOLDER, sheetUrl)`.
  - Add the config, the env example and compose entries, and the docs.
- [ ] **Step 4: Run** the focused command again. Expected: PromptTemplatesIT 8/8.
- [ ] **Step 5: Run** the full `mvn -B verify`. Expected: unit 59/59, every IT green.
