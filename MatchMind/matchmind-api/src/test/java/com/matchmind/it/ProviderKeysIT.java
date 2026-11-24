package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

/** Per-provider keys (mmk_...): the provider comes from the key, scopes gate the endpoints, disable stops a provider. */
class ProviderKeysIT extends IntegrationTestBase {

    private record Created(UUID providerId, String code) {
    }

    private Created provider() throws Exception {
        String code = "k" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode p = adminPost("/api/v1/providers", Map.of("code", code, "name", "Key test " + code));
        return new Created(UUID.fromString(p.get("id").asText()), code);
    }

    private JsonNode issue(UUID providerId, List<String> scopes) throws Exception {
        return adminPost("/api/v1/providers/" + providerId + "/keys",
            scopes == null ? Map.of("label", "agent") : Map.of("label", "agent", "scopes", scopes));
    }

    private MvcResult call(String key, String path, String body) throws Exception {
        return externalWith(Map.of("X-Api-Key", key), path, body);
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private void assertCode(MvcResult res, int status, String code) throws Exception {
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(status);
        assertThat(read(res).get("code").asText()).isEqualTo(code);
    }

    @Test
    void issuedKeyAuthenticatesWithoutXProvider() throws Exception {
        Created p = provider();
        JsonNode key = issue(p.providerId(), null);
        assertThat(key.get("apiKey").asText()).startsWith("mmk_" + key.get("keyId").asText() + "_");
        assertThat(key.get("scopes")).extracting(JsonNode::asText).containsExactly("PREDICTIONS", "SETTLE_REQUEST");

        MvcResult res = call(key.get("apiKey").asText(), "predictions", Payloads.livePrediction(id("e"), id("m"), "gpt-key"));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
        // The per-provider key may still create models, never providers.
        assertThat(db.queryForObject("SELECT count(*) FROM ai_models WHERE provider_id = ? AND name = 'gpt-key'", Long.class,
            p.providerId())).isEqualTo(1);
        assertThat(db.queryForObject("SELECT last_used_at IS NOT NULL FROM provider_api_keys WHERE id = ?", Boolean.class,
            UUID.fromString(key.get("id").asText()))).isTrue();
        // X-Provider naming the key's own provider is fine.
        assertThat(externalWith(Map.of("X-Api-Key", key.get("apiKey").asText(), "X-Provider", p.code().toUpperCase()),
            "predictions", Payloads.livePrediction(id("e"), id("m"), "gpt-key")).getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void revokedKeyIs401() throws Exception {
        Created p = provider();
        JsonNode key = issue(p.providerId(), null);
        adminPost("/api/v1/providers/" + p.providerId() + "/keys/" + key.get("id").asText() + "/revoke", Map.of("reason", "leaked"));
        assertCode(call(key.get("apiKey").asText(), "predictions", Payloads.livePrediction(id("e"), id("m"), "x")), 401,
            "INVALID_API_KEY");
        // A wrong secret for an existing key id is 401 too.
        JsonNode other = issue(p.providerId(), null);
        assertCode(call(other.get("apiKey").asText() + "x", "predictions", Payloads.livePrediction(id("e"), id("m"), "x")),
            401, "INVALID_API_KEY");
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity_id = ? AND action = 'KEY_REVOKE'",
            Long.class, p.providerId())).isEqualTo(1);
    }

    @Test
    void disabledProviderIs403ProviderDisabled() throws Exception {
        Created p = provider();
        JsonNode key = issue(p.providerId(), null);
        mvc.perform(asAdmin(patch("/api/v1/providers/" + p.providerId())).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"DISABLED\",\"reason\":\"misbehaving\"}")).andReturn();
        assertCode(call(key.get("apiKey").asText(), "predictions", Payloads.livePrediction(id("e"), id("m"), "x")), 403,
            "PROVIDER_DISABLED");
        // The legacy shared key cannot write as the disabled provider either, even with the provider id cached.
        assertCode(external(p.code(), "predictions", Payloads.livePrediction(id("e"), id("m"), "x")), 403, "PROVIDER_DISABLED");
        assertThat(db.queryForObject("""
            SELECT count(*) FROM external_api_requests WHERE provider_id = ? AND api_key_id = ? AND http_status = 403
              AND request_status = 'REJECTED'""", Long.class, p.providerId(), UUID.fromString(key.get("id").asText())))
            .isEqualTo(1);
        // Admin import for a disabled provider is refused the same way.
        MvcResult imported = mvc.perform(asAdmin(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .post("/api/v1/predictions/import?provider=" + p.code())).contentType(MediaType.APPLICATION_JSON)
            .content(Payloads.livePrediction(id("e"), id("m"), "x"))).andReturn();
        assertCode(imported, 403, "PROVIDER_DISABLED");
    }

    @Test
    void xProviderMismatchIs403() throws Exception {
        Created p = provider();
        JsonNode key = issue(p.providerId(), null);
        MvcResult res = externalWith(Map.of("X-Api-Key", key.get("apiKey").asText(), "X-Provider", "someone-else"),
            "predictions", Payloads.livePrediction(id("e"), id("m"), "x"));
        assertCode(res, 403, "PROVIDER_MISMATCH");
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = 'someone-else'", Long.class)).isZero();
    }

    @Test
    void legacyKeyStillWorksWhenConfigured() throws Exception {
        Integration in = newIntegration("legacy");
        MvcResult res = external(in.provider(), "predictions", Payloads.livePrediction(id("e"), id("m"), "legacy"));
        assertThat(res.getResponse().getStatus()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT legacy_key FROM external_api_requests WHERE provider_id = ? ORDER BY received_at DESC LIMIT 1",
            Boolean.class, providerId(in))).isTrue();
        JsonNode logs = adminGet("/api/v1/api-logs?providerId=" + providerId(in));
        assertThat(logs.get("data").get(0).get("legacyKey").asBoolean()).isTrue();
    }

    @Test
    void auditRowCarriesApiKeyIdAndNeverTheSecret() throws Exception {
        Created p = provider();
        JsonNode key = issue(p.providerId(), null);
        String apiKey = key.get("apiKey").asText();
        // The secret is base64url, which may itself contain '_': cut after the known "mmk_<keyId>_" prefix.
        String secret = apiKey.substring(("mmk_" + key.get("keyId").asText() + "_").length());
        assertThat(secret).hasSize(43);   // 32 random bytes
        call(apiKey, "predictions", Payloads.livePrediction(id("e"), id("m"), "audit"));
        Map<String, Object> row = db.queryForMap("SELECT * FROM external_api_requests WHERE provider_id = ? ORDER BY received_at DESC LIMIT 1",
            p.providerId());
        assertThat(row.get("api_key_id")).isEqualTo(UUID.fromString(key.get("id").asText()));
        assertThat(row.get("legacy_key")).isEqualTo(false);
        assertThat(row.values().stream().map(String::valueOf)).noneMatch(v -> v.contains(secret));
        // The key table holds only the hash.
        assertThat(db.queryForMap("SELECT * FROM provider_api_keys WHERE id = ?", UUID.fromString(key.get("id").asText()))
            .values().stream().map(String::valueOf)).noneMatch(v -> v.contains(secret));
    }

    // ------------------------------------------------------------------ scopes (Task 3)

    @Test
    void resultsWithoutResultsScopeIs403ScopeRequired() throws Exception {
        Created p = provider();
        String key = issue(p.providerId(), null).get("apiKey").asText();
        String match = id("m");
        call(key, "predictions", Payloads.livePrediction(id("e"), match, "x"));
        MvcResult res = call(key, "matches/results", Payloads.result(match, "FINISHED", "{\"home\":1,\"away\":0}", null,
            "2026-11-10T21:40:00Z"));
        assertCode(res, 403, "SCOPE_REQUIRED");
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE provider_id = ? AND http_status = 403",
            Long.class, p.providerId())).isEqualTo(1);
    }

    @Test
    void resultsWithScopeApplies() throws Exception {
        Created p = provider();
        JsonNode issued = issue(p.providerId(), null);
        String key = issued.get("apiKey").asText();
        String match = id("m");
        call(key, "predictions", Payloads.livePrediction(id("e"), match, "x"));
        // Grant RESULTS to the existing key.
        JsonNode updated = mvcPut("/api/v1/providers/" + p.providerId() + "/keys/" + issued.get("id").asText() + "/scopes",
            Map.of("scopes", List.of("PREDICTIONS", "SETTLE_REQUEST", "RESULTS"), "reason", "trusted feeder"));
        assertThat(updated.get("scopes")).extracting(JsonNode::asText).contains("RESULTS");
        MvcResult res = call(key, "matches/results", Payloads.result(match, "FINISHED", "{\"home\":1,\"away\":0}", null,
            "2026-11-10T21:40:00Z"));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
    }

    @Test
    void predictionsWithoutPredictionsScopeIs403() throws Exception {
        Created p = provider();
        String key = issue(p.providerId(), List.of("RESULTS")).get("apiKey").asText();
        assertCode(call(key, "predictions", Payloads.livePrediction(id("e"), id("m"), "x")), 403, "SCOPE_REQUIRED");
        assertCode(call(key, "predictions/settle", "{\"externalMatchId\":\"nope\"}"), 403, "SCOPE_REQUIRED");
    }

    @Test
    void promptCopyForAPerProviderKeyNeverCarriesTheSharedKey() throws Exception {
        // Own template: the seeded prompts no longer carry the placeholder since they deliver through the Sheet (V31).
        String id = db.queryForObject("INSERT INTO prompt_templates (name, template_type, content) "
            + "VALUES ('Key placeholder', 'AI_PREDICTION', 'Send with X-Api-Key: {{EXTERNAL_API_KEY}}') RETURNING id::text",
            String.class);
        JsonNode copy = adminGet("/api/v1/prompts/" + id + "/for-agent?sharedKey=false");
        assertThat(copy.get("keyRendered").asBoolean()).isFalse();
        assertThat(copy.get("content").asText()).contains("{{EXTERNAL_API_KEY}}").doesNotContain(EXTERNAL_KEY);
    }

    private JsonNode mvcPut(String url, Object body) throws Exception {
        MvcResult res = mvc.perform(asAdmin(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(url))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn();
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        return read(res);
    }
}
