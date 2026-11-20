# MatchMind External Ping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `GET /api/v1/external/ping` that tells a caller the MatchMind API is reachable.

**Architecture:** A new controller returns a fixed JSON body. `SecurityConfig` permits GET on that exact path before the
`/api/v1/external/**` PROVIDER rule. `ApiKeyAuthenticationFilter` skips the path, so no key is checked and no audit row
is written. The path is one constant shared by all three.

**Tech Stack:** Java 25, Spring Boot 3.5, Spring Security, springdoc, Testcontainers ITs (MockMvc).

**Spec:** `docs/superpowers/specs/2026-11-19-matchmind-external-ping-design.md`

## Global Constraints

- Module rules: `MatchMind/AGENTS.override.md`. `MatchMind/docs/API_DOCUMENTATION.md` is the API contract.
- No DB access, no audit row, no provider or model creation for the ping.
- Only `GET` is public. Every other method on the path and every other `/api/v1/external/**` path still needs the key.
- No UI change, no migration, no `chatgpt-action.yaml` change.

## Review Focus

- A caller sends a wrong `X-Api-Key` on the ping: still 200, the key is not checked (docs must say so).
- A non-GET method on the ping path: 401, it stays protected.
- A ping writes no `external_api_requests` row.

---

### Task 1: Public ping endpoint

**Files:**
- Create: `MatchMind/matchmind-api/src/main/java/com/matchmind/external/ExternalPingController.java`
- Modify: `MatchMind/matchmind-api/src/main/java/com/matchmind/security/SecurityConfig.java:59` (insert after the login `permitAll`)
- Modify: `MatchMind/matchmind-api/src/main/java/com/matchmind/security/ApiKeyAuthenticationFilter.java:54-57` (`shouldNotFilter`)
- Modify: `MatchMind/docs/API_DOCUMENTATION.md`, `MatchMind/README.md`
- Test: `MatchMind/matchmind-api/src/test/java/com/matchmind/it/ExternalHeadersIT.java`

**Interfaces:**
- Produces: `ExternalPingController.PATH = "/api/v1/external/ping"`,
  `ExternalPingController.PingResponse(String status, Instant serverTime)`, `PingResponse ping()`.

- [ ] **Step 1: Write the failing test** in `ExternalHeadersIT` (add static import `MockMvcRequestBuilders.get` and
  `java.time.Instant`)

```java
@Test
void pingIsPublicAndWritesNothing() throws Exception {
    MvcResult ping = mvc.perform(get("/api/v1/external/ping")).andReturn();
    assertThat(ping.getResponse().getStatus()).isEqualTo(200);
    assertThat(read(ping).get("status").asText()).isEqualTo("ok");
    assertThat(Instant.parse(read(ping).get("serverTime").asText())).isNotNull(); // ISO-8601 UTC
    // The key is not checked at all, and nothing is audited.
    assertThat(mvc.perform(get("/api/v1/external/ping").header("X-Api-Key", "wrong")).andReturn()
        .getResponse().getStatus()).isEqualTo(200);
    assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE endpoint = '/api/v1/external/ping'",
        Integer.class)).isZero();
    // Only GET is public.
    assertThat(mvc.perform(post("/api/v1/external/ping")).andReturn().getResponse().getStatus()).isEqualTo(401);
}
```

- [ ] **Step 2: Run it to verify it fails** (Docker must be running)

Run: `cd MatchMind/matchmind-api && mvn -B verify -Dit.test=ExternalHeadersIT`
Expected: `pingIsPublicAndWritesNothing` FAILS with `expected: 200 but was: 401` (the key filter rejects it).

- [ ] **Step 3: Implement**
  - `ExternalPingController` (`@RestController`, `@Tag(name = "External AI callbacks")`): `@GetMapping(PATH)`
    `ping()` returns `new PingResponse("ok", Instant.now())`. It is a separate class because `ExternalController` has
    class-level `consumes = application/json`, which answers a GET without `Content-Type` with 415.
  - `SecurityConfig`: `.requestMatchers(HttpMethod.GET, ExternalPingController.PATH).permitAll()` before the
    `/api/v1/external/**` rule.
  - `ApiKeyAuthenticationFilter.shouldNotFilter`: also return `true` when `getRequestURI()` equals
    `ExternalPingController.PATH` (exact match, not a prefix).
  - `API_DOCUMENTATION.md`: an auth-table row for the ping, a short `GET /api/v1/external/ping (public)` section before
    `### 1.` (no key, key not checked, not audited, GET only, response body), and `curl -s $API/external/ping` in the
    curl quick start.
  - `README.md` "Connect an AI provider": one sentence on the ping (no key, not logged), since the next line says every
    call appears on API Logs.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd MatchMind/matchmind-api && mvn -B verify -Dit.test=ExternalHeadersIT`
Expected: `ExternalHeadersIT` `Tests run: 6, Failures: 0, Errors: 0`, then `BUILD SUCCESS`.

- [ ] **Step 5: Commit, only with the user's go-ahead** (master has unrelated local changes: stage only these files)

```bash
git add MatchMind/matchmind-api/src/main/java/com/matchmind/external/ExternalPingController.java \
  MatchMind/matchmind-api/src/main/java/com/matchmind/security/SecurityConfig.java \
  MatchMind/matchmind-api/src/main/java/com/matchmind/security/ApiKeyAuthenticationFilter.java \
  MatchMind/matchmind-api/src/test/java/com/matchmind/it/ExternalHeadersIT.java \
  MatchMind/docs/API_DOCUMENTATION.md MatchMind/README.md
git commit -m "feat(matchmind): public external ping for connectivity tests"
```
