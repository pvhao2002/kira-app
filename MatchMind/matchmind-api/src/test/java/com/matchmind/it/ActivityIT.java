package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Sign-ins (also failed ones) and every change a user makes land in their activity; reads are not recorded. */
class ActivityIT extends IntegrationTestBase {
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36";

    private int loginStatus(String username, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).header("User-Agent", UA)
            .content(json.writeValueAsString(Map.of("username", username, "password", password))))
            .andReturn().getResponse().getStatus();
    }

    private JsonNode activity(String bearer, String query) throws Exception {
        return read(mvc.perform(get("/api/v1/activity" + query).header("Authorization", bearer)).andReturn());
    }

    private static List<String> actions(JsonNode page) {
        List<String> out = new ArrayList<>();
        page.get("data").forEach(r -> out.add(r.get("method").asText() + " " + r.get("path").asText() + " " + r.get("status").asInt()));
        return out;
    }

    @Test
    void recordsSignInsAndChangesAndEachUserSeesOnlyTheirOwn() throws Exception {
        String name = "act" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-987", "role", "VIEWER"));

        assertThat(loginStatus(name, "wrong-password-000")).isEqualTo(401);
        assertThat(loginStatus("nobody-" + name, "my-secret-password")).isEqualTo(401);
        String viewer = "Bearer " + login(name, "viewer-password-987");
        mvc.perform(get("/api/v1/matches").header("Authorization", viewer));          // a read: not recorded
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", viewer).header("User-Agent", UA));
        viewer = "Bearer " + login(name, "viewer-password-987");

        JsonNode mine = activity(viewer, "");
        assertThat(actions(mine)).containsSubsequence(
            "POST /api/v1/auth/login 200", "POST /api/v1/auth/logout 204", "POST /api/v1/auth/login 200", "POST /api/v1/auth/login 401");
        assertThat(actions(mine)).noneMatch(a -> a.startsWith("GET "));
        JsonNode failed = mine.get("data").get(mine.get("data").size() - 1);
        assertThat(failed.get("username").asText()).isEqualTo(name);
        assertThat(failed.get("browser").asText()).isEqualTo("Chrome");
        assertThat(failed.has("clientIp")).isTrue();
        // A viewer cannot look at someone else's activity, even by asking.
        assertThat(activity(viewer, "?username=" + ADMIN).get("data")).allMatch(r -> r.get("username").asText().equals(name));

        // The admin sees every user; a sign-in with an unknown username keeps no username (it may be a typed password).
        JsonNode all = activity("Bearer " + adminToken, "?size=200");
        assertThat(all.toString()).doesNotContain("nobody-" + name).doesNotContain("my-secret-password");
        assertThat(actions(activity("Bearer " + adminToken, "?username=" + name))).hasSize(mine.get("data").size());
        assertThat(all.get("data")).anyMatch(r -> r.get("username").isNull() && r.get("status").asInt() == 401);
    }

    @Test
    void recordsAdminChangesAndRejectedAttempts() throws Exception {
        String name = "act" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-987", "role", "VIEWER"));
        String viewer = "Bearer " + login(name, "viewer-password-987");
        mvc.perform(post("/api/v1/users").header("Authorization", viewer).contentType(MediaType.APPLICATION_JSON).content("{}"));

        assertThat(actions(activity(viewer, ""))).contains("POST /api/v1/users 403");
        assertThat(actions(activity("Bearer " + adminToken, "?username=" + ADMIN))).contains("POST /api/v1/users 201");
    }
}
