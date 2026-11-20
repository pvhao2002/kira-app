# MatchMind Artifact Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sandboxed chat agents queue the MatchMind requests they cannot send in a "MatchMind" artifact, and the user
sends them from the browser (Send / Send all).

**Architecture:** Open CORS on `/api/v1/external/**` only (any origin, no credentials), so a page in a chat can call
the external API. A new Flyway migration seeds an `AI_ARTIFACT` prompt that carries the complete artifact page and
points the two agent prompts' failure paths at it, keeping `CANNOT_CALL_API` as the last resort.

**Tech Stack:** Java 25, Spring Boot 3.5, Spring Security 6 (`UrlBasedCorsConfigurationSource`), Flyway + PostgreSQL 17,
MockMvc + Testcontainers ITs, vanilla HTML/JS for the artifact page.

**Spec:** `docs/superpowers/specs/2026-11-19-matchmind-artifact-outbox-design.md`

## Global Constraints

- Verify: `cd MatchMind/matchmind-api && mvn -B verify` (Docker must run for Testcontainers). Focused runs use
  `mvn -B verify -Dit.test=<IT class> -Dtest=NoUnitTests -Dsurefire.failIfNoSpecifiedTests=false`.
- Work on master, uncommitted (user's choice). No commit, push or deploy.
- New migration only: `V12__prompts_matchmind_artifact.sql`, LF line endings (`MatchMind/.gitattributes`), never edit
  V1-V11. Updates are guarded by `position(<old> IN content) > 0` and set `version = version + 1, updated_at = now()`.
- No `${` anywhere in the SQL: Flyway would treat it as a placeholder.
- The stored prompt keeps the key as `{{EXTERNAL_API_KEY}}`; only the admin `for-agent` copy fills it. Never put the
  key or request bodies in logs or the audit.
- Exact values: template name `MatchMind Artifact Prompt`, type `AI_ARTIFACT`, reply line `QUEUED_IN_ARTIFACT <n>`,
  base URL `https://match.kira.id.vn`, ping `GET /api/v1/external/ping`. Prompt text and page UI in English.
- The dashboard CORS (`/api/v1/**`, `CORS_ALLOWED_ORIGINS`) must not change.

## Review Focus

- A rejected call (401, 400) from the page must carry `Access-Control-Allow-Origin`, or the page can only say
  "cannot reach". Pinned in Task 1.
- Sandboxed iframes (chat artifacts) send `Origin: null`. Pinned in Task 1.
- A V12 `replace()` whose old text differs by one character silently does nothing. Pinned by Task 2's content checks.
- The admin copy replaces every `{{EXTERNAL_API_KEY}}`: a page that compared the key with that text would always
  think the key is missing. Pinned in Task 2 (exactly one occurrence).
- An agent writes `body` as a JSON string instead of an object: the page sends a string as is. Checked in the Task 2
  browser run, together with Vietnamese team names.

---

### Task 1: CORS for the external callbacks

**Files:**
- Modify: `MatchMind/matchmind-api/src/main/java/com/matchmind/security/SecurityConfig.java:88-104`
  (`corsConfigurationSource`; impact: graph `UNKNOWN` because it is a DI bean, text search finds one consumer,
  `http.cors()` in the same class; risk LOW, security-relevant)
- Test: `MatchMind/matchmind-api/src/test/java/com/matchmind/it/ExternalHeadersIT.java`
- Docs: `MatchMind/docs/API_DOCUMENTATION.md` (External callback APIs intro), `MatchMind/docs/ARCHITECTURE.md:19`,
  `MatchMind/README.md` (`CORS_ALLOWED_ORIGINS` row)

**Interfaces:**
- Produces: any origin (also `null`) may send `GET`/`POST` to `/api/v1/external/**` with headers `Content-Type`,
  `X-Api-Key`, `X-Provider`, `X-Model-Name`, `X-Model-Version`, `X-Request-Id`; every response, errors included,
  carries `Access-Control-Allow-Origin: *`; no `Access-Control-Allow-Credentials`.

- [ ] **Step 1: Write the tests** (helper `preflight(path, origin, method, headers)` = `options(path)` with `Origin`,
  `Access-Control-Request-Method`, `Access-Control-Request-Headers`; `FOREIGN = "https://artifact.example"`)

```java
@Test
void browserPagesOnAnyOriginMayCallTheExternalApi() throws Exception {
    for (String origin : List.of(FOREIGN, "null")) { // "null": sandboxed iframes such as chat artifacts
        MvcResult pre = preflight("/api/v1/external/predictions", origin, "POST",
            "content-type,x-api-key,x-provider,x-model-name,x-model-version,x-request-id");
        assertThat(pre.getResponse().getStatus()).as(origin).isEqualTo(200);
        assertThat(pre.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("*");
        assertThat(pre.getResponse().getHeader("Access-Control-Allow-Headers").toLowerCase().split(",\\s*"))
            .containsExactlyInAnyOrder("content-type", "x-api-key", "x-provider", "x-model-name", "x-model-version", "x-request-id");
        assertThat(pre.getResponse().getHeader("Access-Control-Allow-Credentials")).isNull();
    }
    // Real calls carry the header too, a rejected one included, so the page can show the answer.
    Map<String, String> h = new HashMap<>(headers(id("artifact"), "artifact-model"));
    h.put("Origin", FOREIGN);
    MvcResult sent = externalWith(h, "predictions", Payloads.livePrediction(id("e"), id("m"), "ignored"));
    assertThat(sent.getResponse().getStatus()).isEqualTo(201);
    assertThat(sent.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("*");
    MvcResult badKey = externalWith(Map.of("Origin", FOREIGN, "X-Api-Key", "wrong", "X-Provider", "artifact"), "predictions", "{}");
    assertThat(badKey.getResponse().getStatus()).isEqualTo(401);
    assertThat(badKey.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("*");
    MvcResult ping = mvc.perform(get("/api/v1/external/ping").header("Origin", FOREIGN)).andReturn();
    assertThat(ping.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("*");
}

@Test
void dashboardApiStillAnswersOnlyItsOwnOrigins() throws Exception {
    MvcResult foreign = preflight("/api/v1/predictions", FOREIGN, "GET", "authorization");
    assertThat(foreign.getResponse().getStatus()).isEqualTo(403);
    assertThat(foreign.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
    MvcResult own = preflight("/api/v1/predictions", "http://localhost:4200", "GET", "authorization"); // default list
    assertThat(own.getResponse().getStatus()).isEqualTo(200);
    assertThat(own.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:4200");
}
```

- [ ] **Step 2: Run, expect RED**

Run: `mvn -B verify -Dit.test=ExternalHeadersIT -Dtest=NoUnitTests -Dsurefire.failIfNoSpecifiedTests=false`
Expected: `browserPagesOnAnyOriginMayCallTheExternalApi` fails with `expected: 200 but was: 403`;
`dashboardApiStillAnswersOnlyItsOwnOrigins` passes already (guard for the unchanged dashboard rule).

- [ ] **Step 3: Implement in `SecurityConfig.corsConfigurationSource`**

Add a second `CorsConfiguration`: origins `List.of("*")`, methods `GET`, `POST`, headers `Content-Type`,
`ApiKeyAuthenticationFilter.HEADER`, `ApiKeyAuthenticationFilter.PROVIDER_HEADER`, `ExternalController.MODEL_HEADER`,
`ExternalController.MODEL_VERSION_HEADER`, `X-Request-Id`, max age 3600. Register it for `/api/v1/external/**` BEFORE
`/api/v1/**` (the first registered match wins). Replace the stale "server-to-server" comment with why any origin is
safe: the key is a header, never a cookie.

- [ ] **Step 4: Run, expect GREEN**

Run: the Step 2 command. Expected: `Tests run: 10, Failures: 0, Errors: 0` for `ExternalHeadersIT`.

- [ ] **Step 5: Docs**

- `API_DOCUMENTATION.md`, after the audit paragraph of "External callback APIs": browser pages on any origin may call
  these endpoints (`Access-Control-Allow-Origin: *`, `GET`/`POST`, the headers above plus `Content-Type` and
  `X-Request-Id`, no cookies); the key stays a header; the dashboard API keeps `CORS_ALLOWED_ORIGINS`.
- `ARCHITECTURE.md:19`: same origin for the UI; only `/api/v1/external/**` answers other origins.
- `README.md` config row: `CORS_ALLOWED_ORIGINS` is for the dashboard API; `/api/v1/external/**` accepts any origin.

- [ ] **Step 6: No commit** (uncommitted on master).

### Task 2: The MatchMind artifact prompt (V12)

**Files:**
- Create: `MatchMind/matchmind-api/src/main/resources/db/migration/V12__prompts_matchmind_artifact.sql`
- Test: `MatchMind/matchmind-api/src/test/java/com/matchmind/it/PromptTemplatesIT.java`
- Docs: `MatchMind/docs/API_DOCUMENTATION.md:103-105`, `MatchMind/README.md:52-53`

**Interfaces:**
- Consumes: Task 1's CORS (the page calls the API cross-origin); `GET /api/v1/external/ping`;
  `GET /api/v1/prompts/{id}/for-agent` fills `{{EXTERNAL_API_KEY}}`.
- Produces: seeded row `('MatchMind Artifact Prompt', 'AI_ARTIFACT')`; queue item shape
  `{"label", "path", "headers", "body"}`; page globals `const QUEUE = [`, `const API_BASE = "https://match.kira.id.vn";`,
  `const API_KEY = "{{EXTERNAL_API_KEY}}";`.

- [ ] **Step 1: Write the tests**

```java
@Test
void artifactPromptHoldsTheWholeOutboxPage() throws Exception {
    assertThat(db.queryForObject("SELECT count(*) FROM prompt_templates WHERE template_type = 'AI_ARTIFACT'", Integer.class)).isEqualTo(1);
    String id = seededPromptId("AI_ARTIFACT");
    JsonNode stored = adminGet("/api/v1/prompts/" + id);
    assertThat(stored.get("name").asText()).isEqualTo("MatchMind Artifact Prompt");
    String page = stored.get("content").asText();
    assertThat(page).contains("<!DOCTYPE html>", "const QUEUE = [", "const API_BASE = \"https://match.kira.id.vn\";",
        "/api/v1/external/ping", "Send all", "Test connection", "Copy JSON", "QUEUED_IN_ARTIFACT", "Do not publish");
    // Self-contained: chat sandboxes block other files and storage.
    assertThat(page).doesNotContain("<script src", "<link", "@import", "localStorage", "sessionStorage", "http://");
    // One placeholder only: the copy for agents replaces every occurrence, so the page must not compare against it.
    assertThat(StringUtils.countOccurrencesOf(page, "{{EXTERNAL_API_KEY}}")).isEqualTo(1);
    assertThat(page).contains("const API_KEY = \"{{EXTERNAL_API_KEY}}\";").doesNotContain(EXTERNAL_KEY);
    String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
    assertThat(forAgent).contains("const API_KEY = \"" + EXTERNAL_KEY + "\";").doesNotContain("{{EXTERNAL_API_KEY}}");
}

@Test
void bothPromptsQueueFailedRequestsInTheMatchMindArtifact() throws Exception {
    Map<String, String> paths = Map.of("AI_PREDICTION", "\"path\": \"/api/v1/external/predictions\"",
        "AI_SETTLEMENT", "\"path\": \"/api/v1/external/predictions/settle\"");
    for (var e : paths.entrySet()) {
        String prompt = adminGet("/api/v1/prompts/" + seededPromptId(e.getKey())).get("content").asText();
        assertThat(prompt).as(e.getKey()).contains("MatchMind artifact", "\"MatchMind Artifact Prompt\"", e.getValue(),
            "QUEUED_IN_ARTIFACT", "CANNOT_CALL_API");
        // The artifact first; CANNOT_CALL_API only for agents that cannot create artifacts.
        assertThat(prompt.indexOf("MatchMind artifact")).as(e.getKey()).isLessThan(prompt.indexOf("CANNOT_CALL_API"));
    }
}
```

- [ ] **Step 2: Run, expect RED**

Run: `mvn -B verify -Dit.test=PromptTemplatesIT -Dtest=NoUnitTests -Dsurefire.failIfNoSpecifiedTests=false`
Expected: `artifactPromptHoldsTheWholeOutboxPage` fails `expected: 1 but was: 0`;
`bothPromptsQueueFailedRequestsInTheMatchMindArtifact` fails `to contain "MatchMind artifact"`.

- [ ] **Step 3: Write `V12__prompts_matchmind_artifact.sql`**

1. `INSERT INTO prompt_templates (name, template_type, description, content) ... ON CONFLICT (name) DO NOTHING`.
   Content: the agent rules (one artifact per conversation; HTML artifact the chat renders, not a code block; copy the
   TEMPLATE exactly and only append to `QUEUE`; item shape; reply `QUEUED_IN_ARTIFACT <n>`; it holds the key, do not
   publish or share; no artifacts → the prompt's `CANNOT_CALL_API` reply), then `TEMPLATE` and the page in a
   ```` ```html ```` fence. The page:
   - inputs `#base` (prefilled from `API_BASE`) and `#key` (password; empty when `API_KEY` still starts with `{{`,
     tested with `/^\{\{/`, never with the placeholder text);
   - `Test connection` calls `GET <base>/api/v1/external/ping` and shows the server time or the unreachable hint;
   - table: #, label + `POST <path>`, status, `Send` and `Copy JSON`; all text through `textContent`;
   - `send(i)`: `POST <base><path>` with `item.headers` + `Content-Type` + `X-Api-Key` (ours win), body sent as is
     when it is a string, else `JSON.stringify`; 2xx → sent (`already received` when `duplicate`), other status →
     `<status> <code>: <message>` (+ `fieldErrors`), fetch throws → unreachable hint (allow the domain, or Copy JSON);
     returns `stop` for 401, unreachable or no key, else `ok`/`failed`;
   - `Send all`: sequential, skips sent rows, stops on `stop`, disabled while running or when all are sent;
   - `Copy JSON`: shows the body in a read-only textarea, selects it, tries `navigator.clipboard`, falls back to
     `document.execCommand("copy")`;
   - no template literals and no `${` (Flyway), no external resources, no storage.
2. `AI_PREDICTION`: replace the V11 line
   `(no internet in your sandbox, DNS or connection errors), do not retry. Reply with exactly these two lines:` with:
   add "blocked by policy"; put the request in the MatchMind artifact (append to its `QUEUE`, else create it from the
   "MatchMind Artifact Prompt", asking the user to paste that prompt when it is missing); the item
   (`"path": "/api/v1/external/predictions"`, headers `X-Provider`, `X-Model-Name`, `X-Model-Version`); reply
   `QUEUED_IN_ARTIFACT <n>`; then `Only if you cannot create artifacts, reply with exactly these two lines:` so the
   V11 `CANNOT_CALL_API` lines follow unchanged.
3. `AI_SETTLEMENT`: replace the V9 two-line `If you have no tool ... CANNOT_CALL_API ... JSON body.` with the same
   artifact paragraph (`"path": "/api/v1/external/predictions/settle"`, header `X-Provider`), ending with the old
   `CANNOT_CALL_API` + curl sentence as the artifact-less fallback.

- [ ] **Step 4: Run, expect GREEN**

Run: the Step 2 command, then check LF: `grep -c $'\r' V12__prompts_matchmind_artifact.sql` prints `0`.
Expected: `PromptTemplatesIT` `Tests run: 7, Failures: 0, Errors: 0`.

- [ ] **Step 5: Docs**

- `API_DOCUMENTATION.md:103-105`: sandboxed agents keep the request in the MatchMind artifact (built from the
  MatchMind Artifact Prompt) and the user sends it with Send / Send all; agents that cannot create artifacts still
  reply `CANNOT_CALL_API` for Import prediction.
- `README.md` Prompt Notes paragraph: name the third prompt and what it is for.

- [ ] **Step 6: Browser run of the page (spec "Manual browser check")**

Throwaway stack, removed afterwards: `postgres:17-alpine` on port 55433, the API from the working tree on 18090 with
test-only secrets, the page extracted from the seeded template (base `http://localhost:18090`, test key) and served
from `http://localhost:18765` (another origin), plus a wrapper page with `<iframe sandbox="allow-scripts">` for
`Origin: null`. Queue: a LIVE prediction with Vietnamese team names, the same again, one with `body` as a JSON
string, an invalid `{}`, and a settle for the first match.
Expected: Test connection shows the server time; Send all gives 201 sent, 200 already received, 201 sent,
`400 ...` (and continues), 200 sent; with a wrong key Send all stops at the first row with 401; the sandboxed copy
also connects.

- [ ] **Step 7: Full suite**

Run: `cd MatchMind/matchmind-api && mvn -B verify`. Expected: `BUILD SUCCESS`, no failures.
