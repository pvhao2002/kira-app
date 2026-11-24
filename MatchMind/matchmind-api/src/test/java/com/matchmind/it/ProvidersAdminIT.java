package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/** Provider admin API: create, edit, disable/enable and key management. ADMIN only; key secrets are shown once. */
class ProvidersAdminIT extends IntegrationTestBase {

    private MvcResult send(HttpMethod method, String url, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder b = request(method, url).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(body));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return mvc.perform(b).andReturn();
    }

    private JsonNode status(MvcResult res, int expected) throws Exception {
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(expected);
        return read(res);
    }

    private String viewerToken() throws Exception {
        String name = "viewer-" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        return login(name, "viewer-password-1");
    }

    private static String code() {
        return "a" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void viewerGets403OnEveryWrite() throws Exception {
        String viewer = viewerToken();
        JsonNode p = adminPost("/api/v1/providers", Map.of("code", code(), "name", "Viewer test"));
        String id = p.get("id").asText();
        JsonNode key = adminPost("/api/v1/providers/" + id + "/keys", Map.of());
        String keyRow = key.get("id").asText();
        Object[][] writes = {
            {HttpMethod.POST, "/api/v1/providers"}, {HttpMethod.PATCH, "/api/v1/providers/" + id},
            {HttpMethod.POST, "/api/v1/providers/" + id + "/keys"}, {HttpMethod.GET, "/api/v1/providers/" + id + "/keys"},
            {HttpMethod.POST, "/api/v1/providers/" + id + "/keys/" + keyRow + "/revoke"},
            {HttpMethod.POST, "/api/v1/providers/" + id + "/keys/" + keyRow + "/rotate"},
            {HttpMethod.PUT, "/api/v1/providers/" + id + "/keys/" + keyRow + "/scopes"}};
        for (Object[] w : writes) {
            assertThat(send((HttpMethod) w[0], (String) w[1], viewer, Map.of("code", code(), "name", "x", "reason", "x"))
                .getResponse().getStatus()).as(w[1].toString()).isEqualTo(403);
        }
        // Providers are admin only: viewers cannot even list them.
        assertThat(send(HttpMethod.GET, "/api/v1/providers", viewer, Map.of()).getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void createDisableEnableRoundTrip() throws Exception {
        String c = code();
        JsonNode created = status(send(HttpMethod.POST, "/api/v1/providers", adminToken,
            Map.of("code", c.toUpperCase(), "name", "Round trip", "description", "feeds odds")), 201);
        assertThat(created.get("code").asText()).isEqualTo(c);
        assertThat(created.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(created.get("activeKeys").asLong()).isZero();
        String id = created.get("id").asText();

        assertThat(read(send(HttpMethod.POST, "/api/v1/providers", adminToken, Map.of("code", c, "name", "dup")))
            .get("code").asText()).isEqualTo("PROVIDER_EXISTS");
        assertThat(send(HttpMethod.POST, "/api/v1/providers", adminToken, Map.of("code", "!bad", "name", "x"))
            .getResponse().getStatus()).isEqualTo(400);

        // A status change needs a reason.
        assertThat(read(send(HttpMethod.PATCH, "/api/v1/providers/" + id, adminToken, Map.of("status", "DISABLED")))
            .get("code").asText()).isEqualTo("REASON_REQUIRED");
        JsonNode disabled = status(send(HttpMethod.PATCH, "/api/v1/providers/" + id, adminToken,
            Map.of("status", "DISABLED", "reason", "leaked key", "name", "Renamed")), 200);
        assertThat(disabled.get("status").asText()).isEqualTo("DISABLED");
        assertThat(disabled.get("disabledAt").isNull()).isFalse();
        assertThat(disabled.get("disabledReason").asText()).isEqualTo("leaked key");
        assertThat(disabled.get("name").asText()).isEqualTo("Renamed");
        assertThat(disabled.get("code").asText()).isEqualTo(c);

        JsonNode enabled = status(send(HttpMethod.PATCH, "/api/v1/providers/" + id, adminToken,
            Map.of("status", "ACTIVE", "reason", "rotated")), 200);
        assertThat(enabled.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(enabled.get("disabledAt").isNull()).isTrue();
        assertThat(db.queryForList("SELECT action FROM admin_actions WHERE entity_id = ? ORDER BY at", String.class,
            UUID.fromString(id))).containsExactly("DISABLE", "ENABLE");
        assertThat(send(HttpMethod.PATCH, "/api/v1/providers/" + UUID.randomUUID(), adminToken, Map.of("name", "x"))
            .getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    void keyListNeverContainsTheSecretAndRotateKeepsTheOldKey() throws Exception {
        String id = adminPost("/api/v1/providers", Map.of("code", code(), "name", "Keys")).get("id").asText();
        MvcResult issued = send(HttpMethod.POST, "/api/v1/providers/" + id + "/keys", adminToken, Map.of("label", "bot"));
        JsonNode key = status(issued, 201);
        assertThat(issued.getResponse().getHeader("Cache-Control")).contains("no-store");
        String apiKey = key.get("apiKey").asText();

        JsonNode rotated = status(send(HttpMethod.POST, "/api/v1/providers/" + id + "/keys/" + key.get("id").asText()
            + "/rotate", adminToken, Map.of()), 201);
        assertThat(rotated.get("apiKey").asText()).isNotEqualTo(apiKey);
        assertThat(rotated.get("label").asText()).isEqualTo("bot");

        JsonNode list = adminGet("/api/v1/providers/" + id + "/keys");
        assertThat(list).hasSize(2);
        assertThat(list.toString()).doesNotContain(apiKey.substring(17)).doesNotContain("secret").doesNotContain("apiKey");
        for (JsonNode k : list) assertThat(k.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(adminGet("/api/v1/providers").toString()).contains("\"activeKeys\":2");

        // Invalid scopes are refused; revoking twice is a no-op.
        assertThat(read(send(HttpMethod.POST, "/api/v1/providers/" + id + "/keys", adminToken,
            Map.of("scopes", java.util.List.of("ADMIN")))).get("code").asText()).isEqualTo("INVALID_SCOPES");
        String revoke = "/api/v1/providers/" + id + "/keys/" + key.get("id").asText() + "/revoke";
        assertThat(send(HttpMethod.POST, revoke, adminToken, Map.of("reason", "rotated")).getResponse().getStatus()).isEqualTo(204);
        assertThat(send(HttpMethod.POST, revoke, adminToken, Map.of("reason", "again")).getResponse().getStatus()).isEqualTo(204);
        assertThat(send(HttpMethod.POST, "/api/v1/providers/" + id + "/keys/" + UUID.randomUUID() + "/revoke", adminToken,
            Map.of("reason", "x")).getResponse().getStatus()).isEqualTo(404);
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity_id = ? AND action = 'KEY_REVOKE'",
            Long.class, UUID.fromString(id))).isEqualTo(1);
    }

    @Test
    void revokedKeyCannotBeRotatedOrRescoped() throws Exception {
        String id = adminPost("/api/v1/providers", Map.of("code", code(), "name", "Revoked")).get("id").asText();
        String keyRow = adminPost("/api/v1/providers/" + id + "/keys", Map.of("label", "old")).get("id").asText();
        String base = "/api/v1/providers/" + id + "/keys/" + keyRow;
        assertThat(send(HttpMethod.POST, base + "/revoke", adminToken, Map.of("reason", "leaked")).getResponse().getStatus()).isEqualTo(204);

        assertThat(status(send(HttpMethod.POST, base + "/rotate", adminToken, Map.of()), 409).get("code").asText())
            .isEqualTo("KEY_REVOKED");
        assertThat(status(send(HttpMethod.PUT, base + "/scopes", adminToken,
            Map.of("scopes", java.util.List.of("PREDICTIONS", "RESULTS"), "reason", "grant")), 409).get("code").asText())
            .isEqualTo("KEY_REVOKED");
        assertThat(adminGet("/api/v1/providers/" + id + "/keys")).hasSize(1);
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity_id = ? AND action = 'KEY_SCOPES'",
            Long.class, UUID.fromString(id))).isZero();
    }
}
