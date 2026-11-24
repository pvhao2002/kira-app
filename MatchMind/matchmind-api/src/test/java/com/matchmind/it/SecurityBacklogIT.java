package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.prediction.PredictionEvents;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/** Security and operations backlog (UX-026, 031, 043, 044, 052, 059, 062, 064, 068, 071, 079, 085, 089, 090, 124). */
class SecurityBacklogIT extends IntegrationTestBase {
    private static final String PASSWORD = "viewer-password-1";

    @Autowired
    PredictionEvents events;

    private static String unique(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 6);
    }

    private JsonNode createUser(String role) throws Exception {
        return adminPost("/api/v1/users", Map.of("username", unique("u"), "password", PASSWORD, "role", role));
    }

    private MvcResult loginFrom(String ip, String username, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").header("X-Forwarded-For", ip).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", username, "password", password)))).andReturn();
    }

    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder b) {
        return b.header("Authorization", "Bearer " + token);
    }

    private int status(MockHttpServletRequestBuilder b) throws Exception {
        return mvc.perform(b).andReturn().getResponse().getStatus();
    }

    private MvcResult postJson(String token, String url, Object body) throws Exception {
        return mvc.perform(as(token, post(url)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(body))).andReturn();
    }

    // ---- UX-026 -----------------------------------------------------------------------------------------------

    @Test
    void viewerCannotReadApiLogs() throws Exception {
        String viewer = login(createUser("VIEWER").get("username").asText(), PASSWORD);
        assertThat(status(as(viewer, get("/api/v1/api-logs")))).isEqualTo(403);
        assertThat(status(as(viewer, get("/api/v1/api-logs/endpoints")))).isEqualTo(403);
        assertThat(status(as(viewer, get("/api/v1/api-logs/" + UUID.randomUUID())))).isEqualTo(403);
        assertThat(status(asAdmin(get("/api/v1/api-logs")))).isEqualTo(200);
        // Pages viewers keep stay readable.
        assertThat(status(as(viewer, get("/api/v1/matches")))).isEqualTo(200);
    }

    // ---- UX-068: one error shape, no Java types ---------------------------------------------------------------

    @Test
    void securityErrorsHaveTheStandardShapeInUtf8() throws Exception {
        for (MockHttpServletRequestBuilder b : List.of(get("/api/v1/matches"),
            as(login(createUser("VIEWER").get("username").asText(), PASSWORD), get("/api/v1/users")))) {
            MvcResult res = mvc.perform(b).andReturn();
            JsonNode body = read(res);
            assertThat(res.getResponse().getContentType()).containsIgnoringCase("charset=UTF-8");
            assertThat(body.get("timestamp").asText()).isNotBlank();
            assertThat(body.get("path").asText()).startsWith("/api/v1/");
            assertThat(body.get("traceId").asText()).hasSize(36);
            assertThat(body.has("fieldErrors")).isTrue();
            assertThat(body.get("code").asText()).isIn("UNAUTHORIZED", "FORBIDDEN");
        }
        MvcResult noKey = externalWith(Map.of("X-Provider", "acme"), "predictions", "{}");
        assertThat(read(noKey).get("traceId").asText()).hasSize(36);
        assertThat(noKey.getResponse().getHeader("Referrer-Policy")).isEqualTo("no-referrer");
    }

    @Test
    void badQueryParametersNeverLeakJavaTypes() throws Exception {
        for (String url : List.of("/api/v1/dashboard?from=2026-13-45", "/api/v1/matches?from=garbage")) {
            MvcResult res = mvc.perform(asAdmin(get(url))).andReturn();
            String body = res.getResponse().getContentAsString();
            assertThat(res.getResponse().getStatus()).as(url).isEqualTo(400);
            assertThat(body).as(url).doesNotContain("java.").doesNotContain("Failed to convert").doesNotContain("[class");
            assertThat(body).as(url).contains("ISO-8601");
        }
    }

    // ---- UX-071 -----------------------------------------------------------------------------------------------

    @Test
    void invalidIdInThePathIsNotFound() throws Exception {
        MvcResult res = mvc.perform(asAdmin(get("/api/v1/predictions/not-a-uuid"))).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(404);
        assertThat(read(res).get("message").asText()).isEqualTo("Prediction not found");
        assertThat(status(asAdmin(get("/api/v1/matches/xyz")))).isEqualTo(404);
        assertThat(read(mvc.perform(asAdmin(get("/api/v1/api-logs/xyz"))).andReturn()).get("message").asText()).isEqualTo("Api log not found");
    }

    // ---- UX-079 / UX-085 --------------------------------------------------------------------------------------

    @Test
    void unsupportedMediaTypeSaysWhatToSend() throws Exception {
        MvcResult res = mvc.perform(post("/api/v1/external/predictions").contentType(MediaType.TEXT_PLAIN).content("{}")
            .header("X-Api-Key", EXTERNAL_KEY).header("X-Provider", "acme")).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(415);
        assertThat(read(res).get("message").asText()).contains("application/json");
    }

    @Test
    void validationAndTimeFormatMessagesNameTheLimitAndTheFormat() throws Exception {
        String provider = unique("p");
        ObjectNode longName = (ObjectNode) json.readTree(Payloads.livePrediction(unique("e"), unique("m"), "x".repeat(129)));
        JsonNode fields = read(external(provider, "predictions", json.writeValueAsString(longName))).get("fieldErrors");
        assertThat(fields.get("model.name").asText()).isEqualTo("must be at most 128 characters");

        String noOffset = Payloads.livePrediction(unique("e"), unique("m"), "m1").replace("2026-11-10T19:45:00Z", "2026-12-05T20:00:00");
        MvcResult res = external(provider, "predictions", noOffset);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("fieldErrors").get("match.startTime").asText())
            .contains("ISO-8601").contains("2026-12-05T20:00:00Z");
    }

    // ---- UX-031 -----------------------------------------------------------------------------------------------

    @Test
    void trivialPasswordsAreRejected() throws Exception {
        for (String weak : List.of("aaaaaaaaaa", "1234567890", "Password123", "qwertyuiop")) {
            MvcResult res = postJson(adminToken, "/api/v1/users", Map.of("username", unique("w"), "password", weak, "role", "VIEWER"));
            assertThat(res.getResponse().getStatus()).as(weak).isEqualTo(400);
            assertThat(read(res).get("code").asText()).isEqualTo("WEAK_PASSWORD");
            assertThat(read(res).get("fieldErrors").has("password")).isTrue();
        }
        JsonNode user = createUser("VIEWER");
        assertThat(postJson(adminToken, "/api/v1/users/" + user.get("id").asText() + "/reset-password",
            Map.of("newPassword", "aaaaaaaaaa")).getResponse().getStatus()).isEqualTo(400);
        String token = login(user.get("username").asText(), PASSWORD);
        assertThat(postJson(token, "/api/v1/auth/change-password",
            Map.of("currentPassword", PASSWORD, "newPassword", "1234567890")).getResponse().getStatus()).isEqualTo(400);
    }

    // ---- UX-043 / UX-074 --------------------------------------------------------------------------------------

    @Test
    void wrongPasswordsLockOnlyThatUserAndIpAndAnAdminCanUnlock() throws Exception {
        JsonNode user = createUser("VIEWER");
        String name = user.get("username").asText();
        for (int i = 0; i < 5; i++) assertThat(loginFrom("203.0.113.10", name, "wrong-password").getResponse().getStatus()).isEqualTo(401);
        MvcResult locked = loginFrom("203.0.113.10", name, PASSWORD);
        assertThat(locked.getResponse().getStatus()).isEqualTo(429);
        assertThat(locked.getResponse().getHeader("Retry-After")).isNotBlank();
        // The real owner, on another network, is not locked out by a stranger's guesses.
        assertThat(loginFrom("198.51.100.20", name, PASSWORD).getResponse().getStatus()).isEqualTo(200);

        JsonNode listed = null;
        for (JsonNode u : adminGet("/api/v1/users")) if (name.equals(u.get("username").asText())) listed = u;
        assertThat(listed.get("loginLocked").asBoolean()).isTrue();
        assertThat(postJson(adminToken, "/api/v1/users/" + user.get("id").asText() + "/unlock", Map.of()).getResponse().getStatus()).isEqualTo(204);
        assertThat(loginFrom("203.0.113.10", name, PASSWORD).getResponse().getStatus()).isEqualTo(200);
        assertThat(db.queryForObject("SELECT count(*) FROM user_audit WHERE target_username = ? AND action = 'LOGIN_UNLOCKED' "
            + "AND actor_username = 'admin'", Integer.class, name)).isEqualTo(1);
    }

    @Test
    void viewerCannotUnlockOrGeneratePasswords() throws Exception {
        String viewer = login(createUser("VIEWER").get("username").asText(), PASSWORD);
        assertThat(postJson(viewer, "/api/v1/users/" + UUID.randomUUID() + "/unlock", Map.of()).getResponse().getStatus()).isEqualTo(403);
        assertThat(postJson(viewer, "/api/v1/users/generate-password", Map.of()).getResponse().getStatus()).isEqualTo(403);
        assertThat(status(as(viewer, get("/api/v1/users/audit")))).isEqualTo(403);
    }

    // ---- UX-062 -----------------------------------------------------------------------------------------------

    @Test
    void changePasswordIsRateLimitedAndMustDiffer() throws Exception {
        JsonNode user = createUser("VIEWER");
        String token = login(user.get("username").asText(), PASSWORD);
        MvcResult same = postJson(token, "/api/v1/auth/change-password", Map.of("currentPassword", PASSWORD, "newPassword", PASSWORD));
        assertThat(same.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(same).get("code").asText()).isEqualTo("PASSWORD_UNCHANGED");
        assertThat(status(as(token, get("/api/v1/auth/me")))).isEqualTo(200); // a rejected change signs nobody out

        for (int i = 0; i < 5; i++) {
            assertThat(postJson(token, "/api/v1/auth/change-password", Map.of("currentPassword", "wrong-password-9",
                "newPassword", "another-password-9")).getResponse().getStatus()).isEqualTo(400);
        }
        MvcResult limited = postJson(token, "/api/v1/auth/change-password", Map.of("currentPassword", "wrong-password-9",
            "newPassword", "another-password-9"));
        assertThat(limited.getResponse().getStatus()).isEqualTo(429);
        // Even the right current password is refused while the limit holds.
        assertThat(postJson(token, "/api/v1/auth/change-password", Map.of("currentPassword", PASSWORD,
            "newPassword", "another-password-9")).getResponse().getStatus()).isEqualTo(429);
    }

    // ---- UX-044 -----------------------------------------------------------------------------------------------

    @Test
    void roleChangesAreAudited() throws Exception {
        JsonNode user = createUser("VIEWER");
        String id = user.get("id").asText();
        assertThat(mvc.perform(asAdmin(patch("/api/v1/users/" + id)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"role\":\"ADMIN\"}")).andReturn().getResponse().getStatus()).isEqualTo(200);
        Map<String, Object> row = db.queryForMap("SELECT actor_username, old_value, new_value, at FROM user_audit "
            + "WHERE target_id = ?::uuid AND action = 'ROLE_CHANGED'", id);
        assertThat(row).containsEntry("actor_username", "admin").containsEntry("old_value", "VIEWER").containsEntry("new_value", "ADMIN");
        assertThat(row.get("at")).isNotNull();

        JsonNode trail = adminGet("/api/v1/users/audit?userId=" + id);
        assertThat(trail.get("data").toString()).contains("ROLE_CHANGED").contains("USER_CREATED");
        // Setting the role it already has is not a change.
        mvc.perform(asAdmin(patch("/api/v1/users/" + id)).contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"));
        assertThat(db.queryForObject("SELECT count(*) FROM user_audit WHERE target_id = ?::uuid AND action = 'ROLE_CHANGED'",
            Integer.class, id)).isEqualTo(1);
    }

    // ---- UX-052 -----------------------------------------------------------------------------------------------

    @Test
    void apiLogsNameTheProviderAndTheActingAdmin() throws Exception {
        String provider = unique("chatgpt-");
        ObjectNode p = (ObjectNode) json.readTree(Payloads.livePrediction("unused", "unused", "unused"));
        p.remove(List.of("eventId", "model", "predictedAt"));
        ((ObjectNode) p.get("match")).remove(List.of("externalMatchId", "startTime"));
        MvcResult imported = mvc.perform(asAdmin(post("/api/v1/predictions/import?provider=" + provider + "&model=gpt-x"))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andReturn();
        assertThat(imported.getResponse().getStatus()).as(imported.getResponse().getContentAsString()).isEqualTo(201);

        String logId = db.queryForObject("SELECT r.id::text FROM external_api_requests r JOIN providers pv ON pv.id = r.provider_id "
            + "WHERE pv.code = ? AND r.endpoint LIKE '%/predictions/import'", String.class, provider);
        JsonNode detail = adminGet("/api/v1/api-logs/" + logId);
        assertThat(detail.get("actor").asText()).isEqualTo("admin");
        assertThat(detail.get("providerName").asText()).isNotBlank().isNotEqualTo(detail.get("providerId").asText());

        // Settle from the UI leaves a row naming the admin, even when the call is rejected.
        assertThat(postJson(adminToken, "/api/v1/settlements/matches/" + UUID.randomUUID(), Map.of()).getResponse().getStatus()).isEqualTo(404);
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE actor = 'admin' "
            + "AND endpoint LIKE '/api/v1/settlements/matches/%' AND http_status = 404", Integer.class)).isPositive();
        // Agents never carry an actor.
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE actor IS NOT NULL AND provider_id IS NOT NULL "
            + "AND endpoint LIKE '/api/v1/external/%'", Integer.class)).isZero();
    }

    // ---- UX-090 / UX-124 --------------------------------------------------------------------------------------

    @Test
    void logoutEndsOnlyThisSessionAndLogoutAllEndsEverySession() throws Exception {
        String name = createUser("VIEWER").get("username").asText();
        String a = login(name, PASSWORD);
        String b = login(name, PASSWORD);
        assertThat(status(as(a, post("/api/v1/auth/logout")))).isEqualTo(204);
        assertThat(status(as(a, get("/api/v1/auth/me")))).isEqualTo(401);
        assertThat(status(as(b, get("/api/v1/auth/me")))).isEqualTo(200);

        String c = login(name, PASSWORD);
        assertThat(status(as(c, post("/api/v1/auth/logout-all")))).isEqualTo(204);
        assertThat(status(as(b, get("/api/v1/auth/me")))).isEqualTo(401);
        assertThat(status(as(c, get("/api/v1/auth/me")))).isEqualTo(401);
    }

    @Test
    void refreshIssuesANewTokenForAnActiveSessionOnly() throws Exception {
        String name = createUser("VIEWER").get("username").asText();
        String old = login(name, PASSWORD);
        MvcResult res = mvc.perform(as(old, post("/api/v1/auth/refresh"))).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        String fresh = read(res).get("accessToken").asText();
        assertThat(fresh).isNotEqualTo(old);
        assertThat(read(res).get("user").get("username").asText()).isEqualTo(name);
        assertThat(status(as(fresh, get("/api/v1/auth/me")))).isEqualTo(200);
        // A refreshed session still ends with its own logout.
        assertThat(status(as(fresh, post("/api/v1/auth/logout")))).isEqualTo(204);
        assertThat(status(as(fresh, post("/api/v1/auth/refresh")))).isEqualTo(401);
        assertThat(status(post("/api/v1/auth/refresh"))).isEqualTo(401);
    }

    // ---- UX-059 -----------------------------------------------------------------------------------------------

    @Test
    void mustChangePasswordIsEnforcedUntilThePasswordChanges() throws Exception {
        String name = unique("temp");
        String generated = read(postJson(adminToken, "/api/v1/users/generate-password", Map.of())).get("password").asText();
        assertThat(generated).hasSize(16);
        assertThat(postJson(adminToken, "/api/v1/users", Map.of("username", name, "password", generated, "role", "VIEWER",
            "mustChangePassword", true)).getResponse().getStatus()).isEqualTo(201);

        MvcResult res = loginFrom("203.0.113.55", name, generated);
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(res).get("user").get("mustChangePassword").asBoolean()).isTrue();
        String token = read(res).get("accessToken").asText();

        MvcResult blocked = mvc.perform(as(token, get("/api/v1/matches"))).andReturn();
        assertThat(blocked.getResponse().getStatus()).isEqualTo(403);
        assertThat(read(blocked).get("code").asText()).isEqualTo("PASSWORD_CHANGE_REQUIRED");
        assertThat(status(as(token, post("/api/v1/auth/refresh")))).isEqualTo(403);
        assertThat(read(mvc.perform(as(token, get("/api/v1/auth/me"))).andReturn()).get("mustChangePassword").asBoolean()).isTrue();

        assertThat(postJson(token, "/api/v1/auth/change-password", Map.of("currentPassword", generated,
            "newPassword", "my-own-password-77")).getResponse().getStatus()).isEqualTo(204);
        String after = login(name, "my-own-password-77");
        assertThat(status(as(after, get("/api/v1/matches")))).isEqualTo(200);
    }

    @Test
    void adminResetCanForceAChangeToo() throws Exception {
        JsonNode user = createUser("VIEWER");
        assertThat(postJson(adminToken, "/api/v1/users/" + user.get("id").asText() + "/reset-password",
            Map.of("newPassword", "temporary-pass-42", "mustChangePassword", true)).getResponse().getStatus()).isEqualTo(204);
        String token = login(user.get("username").asText(), "temporary-pass-42");
        assertThat(status(as(token, get("/api/v1/matches")))).isEqualTo(403);
    }

    // ---- UX-064 / UX-089 --------------------------------------------------------------------------------------

    @Test
    void streamsEndWhenTheSessionIsRevokedAndAreCappedPerUser() throws Exception {
        JsonNode user = createUser("VIEWER");
        String name = user.get("username").asText();
        String t1 = login(name, PASSWORD);
        String t2 = login(name, PASSWORD);

        int before = events.openStreams();
        for (int i = 0; i < 6; i++) {
            mvc.perform(as(i % 2 == 0 ? t1 : t2, get("/api/v1/events/predictions"))).andExpect(request().asyncStarted());
        }
        assertThat(events.openStreams() - before).as("the sixth stream closes the oldest").isEqualTo(5);

        // Logging out one session ends only that session's streams.
        mvc.perform(as(t1, post("/api/v1/auth/logout")));
        assertThat(events.openStreams() - before).as("only the streams of the second session remain").isEqualTo(3);
        // Disabling the user ends the rest at once.
        mvc.perform(asAdmin(patch("/api/v1/users/" + user.get("id").asText())).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"DISABLED\"}"));
        assertThat(events.openStreams() - before).isZero();
    }
}
