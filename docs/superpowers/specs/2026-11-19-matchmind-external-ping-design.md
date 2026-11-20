# MatchMind external ping — design

Date: 2026-11-19. Size: small change. Status: approved in chat (option B).

## Intent

Let anyone check that the MatchMind API is reachable from outside (DNS, TLS, nginx, API up) before wiring an agent.
It is a testing aid only.

## Approaches

- A: `GET /api/v1/external/ping` behind `X-Api-Key` + `X-Provider`, audited. It also tests the key and the headers.
  Not picked.
- **B (picked): public `GET /api/v1/external/ping`, no key, no audit.** It tests reachability only.
- Rejected: an nginx `return 200` never reaches the API. Exposing `/actuator/health` through nginx changes infra.

## Design

- New `ExternalPingController` in package `external`: `GET /api/v1/external/ping` returns
  `200 {"status":"ok","serverTime":"<UTC instant>"}`. No DB access, no side effects.
- `SecurityConfig`: `permitAll` for `GET /api/v1/external/ping`, placed before the `/api/v1/external/**` PROVIDER rule.
  Other methods on that path stay protected.
- `ApiKeyAuthenticationFilter.shouldNotFilter`: skip a GET on that exact path, so no key is asked and no REJECTED audit
  row is written. Other methods on the path still get the key check: `401 INVALID_API_KEY` without a key, `405` with
  one (changed after the final review; skipping every method gave a valid-key POST a misleading `401 UNAUTHORIZED`).
- The path is one constant on the controller, used by the mapping, the security rule and the filter.
- Separate controller, because `ExternalController` has class-level `consumes = application/json` (a GET without
  `Content-Type` would get 415) and `@SecurityRequirement("apiKey")`.

## Non-goals

No audit row, no provider or model creation, no key check, no UI change, no migration, no entry in
`chatgpt-action.yaml`.

## Constraints

- The endpoint is public. Only the nginx `external_api` rate limit (10 r/s per IP, burst 50) protects it, so it must stay
  free of side effects.
- `MatchMind/docs/API_DOCUMENTATION.md` is the API contract and documents the endpoint.

## Verification

`ExternalHeadersIT.pingIsPublicAndWritesNothing`: a GET to the ping without headers, or with a wrong key, returns 200
with the body, and no `external_api_requests` row is written for it.
`ExternalHeadersIT.otherMethodsOnPingStillNeedTheKey`: a POST without a key returns `401 INVALID_API_KEY`; with a valid
key it returns 405.

Builder's calls: test placement and assertion details.
