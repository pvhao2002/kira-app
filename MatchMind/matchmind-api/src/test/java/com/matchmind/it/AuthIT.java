package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

class AuthIT extends IntegrationTestBase {

    @Test
    void protectedApisRequireAuthentication() throws Exception {
        assertThat(mvc.perform(get("/api/v1/matches")).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/matches").header("Authorization", "Bearer garbage")).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(asAdmin(get("/api/v1/matches"))).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(asAdmin(get("/api/v1/auth/me"))).andReturn().getResponse().getContentAsString()).contains("\"role\":\"ADMIN\"");
        // A user JWT is not an API key: management tokens cannot call the external callbacks.
        assertThat(mvc.perform(asAdmin(post("/api/v1/external/predictions")).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void thereIsNoPublicRegistration() throws Exception {
        int status = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"x\",\"password\":\"yyyyyyyyyyyy\"}")).andReturn().getResponse().getStatus();
        assertThat(status).isIn(401, 403, 404);
        assertThat(mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"x1\",\"password\":\"yyyyyyyyyyyy\",\"role\":\"ADMIN\"}")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void viewerCanReadButNotChange() throws Exception {
        adminPost("/api/v1/users", Map.of("username", "viewer1", "password", "viewer-password-1", "role", "VIEWER"));
        String viewer = login("viewer1", "viewer-password-1");
        assertThat(mvc.perform(get("/api/v1/providers").header("Authorization", "Bearer " + viewer)).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post("/api/v1/providers").header("Authorization", "Bearer " + viewer).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"nope\",\"name\":\"Nope\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void logoutAndPasswordChangeRevokeTokens() throws Exception {
        adminPost("/api/v1/users", Map.of("username", "analyst2", "password", "analyst-password-1", "role", "VIEWER"));
        String token = login("analyst2", "analyst-password-1");
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer " + token));
        assertThat(mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andReturn().getResponse().getStatus()).isEqualTo(401);

        String fresh = login("analyst2", "analyst-password-1");
        assertThat(mvc.perform(post("/api/v1/auth/change-password").header("Authorization", "Bearer " + fresh)
            .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"analyst-password-1\",\"newPassword\":\"analyst-password-2\"}"))
            .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + fresh)).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(login("analyst2", "analyst-password-2")).isNotBlank();
        String hash = db.queryForObject("SELECT password_hash FROM users WHERE username = 'analyst2'", String.class);
        assertThat(hash).startsWith("$2").doesNotContain("analyst-password-2");
    }

    @Test
    void wrongPasswordIsRejectedAndRepeatedFailuresAreRateLimited() throws Exception {
        adminPost("/api/v1/users", Map.of("username", "target", "password", "target-password-1", "role", "VIEWER"));
        int last = 0;
        for (int i = 0; i < 6; i++) {
            last = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"target\",\"password\":\"wrong-password\"}")).andReturn().getResponse().getStatus();
            if (i < 5) assertThat(last).isEqualTo(401);
        }
        assertThat(last).isEqualTo(429);
    }

    @Test
    void loginValidatesInput() throws Exception {
        assertThat(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"\"}"))
            .andReturn().getResponse().getStatus()).isEqualTo(400);
    }
}
