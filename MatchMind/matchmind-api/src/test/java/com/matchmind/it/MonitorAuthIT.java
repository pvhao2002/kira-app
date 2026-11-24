package com.matchmind.it;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** /monitor (Grafana) sign-in: an admin's session token in a /monitor-scoped cookie, checked by nginx auth_request. */
class MonitorAuthIT extends IntegrationTestBase {

    private MockHttpServletResponse check(String cookieToken) throws Exception {
        var req = get("/api/v1/auth/monitor-check");
        if (cookieToken != null) req.cookie(new Cookie("mm_monitor", cookieToken));
        return mvc.perform(req).andReturn().getResponse();
    }

    @Test
    void adminGetsAMonitorCookieThatPassesTheCheck() throws Exception {
        MockHttpServletResponse res = mvc.perform(asAdmin(post("/api/v1/auth/monitor-session"))).andReturn().getResponse();
        assertThat(res.getStatus()).isEqualTo(204);
        assertThat(res.getHeaders("Set-Cookie")).hasSize(2).allSatisfy(c -> assertThat(c).startsWith("mm_monitor=" + adminToken)
            .contains("HttpOnly", "Secure", "SameSite=Strict"));
        assertThat(String.join(" ", res.getHeaders("Set-Cookie"))).contains("Path=/monitor;", "Path=/swagger;");

        MockHttpServletResponse ok = check(adminToken);
        assertThat(ok.getStatus()).isEqualTo(204);
        assertThat(ok.getHeader("X-Monitor-User")).isEqualTo(ADMIN);
    }

    @Test
    void checkRejectsMissingBadViewerAndRevokedTokens() throws Exception {
        assertThat(check(null).getStatus()).isEqualTo(401);
        assertThat(check("garbage").getStatus()).isEqualTo(401);

        adminPost("/api/v1/users", Map.of("username", "watcher", "password", "watcher-password-1", "role", "VIEWER"));
        String viewer = login("watcher", "watcher-password-1");
        assertThat(check(viewer).getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/api/v1/auth/monitor-session").header("Authorization", "Bearer " + viewer))
            .andReturn().getResponse().getStatus()).isEqualTo(403);

        String admin2 = login(ADMIN, ADMIN_PASSWORD);
        assertThat(check(admin2).getStatus()).isEqualTo(204);
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer " + admin2));
        assertThat(check(admin2).getStatus()).isEqualTo(401);
    }

    @Test
    void theCookieIsNotAcceptedAnywhereElse() throws Exception {
        assertThat(mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("mm_monitor", adminToken)))
            .andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void onlyAdminsReadTheSheetLink() throws Exception {
        MockHttpServletResponse admin = mvc.perform(asAdmin(get("/api/v1/auth/sheet"))).andReturn().getResponse();
        assertThat(admin.getStatus()).isEqualTo(200);
        assertThat(admin.getContentAsString()).isEqualTo("{\"url\":\"" + SHEET_URL + "\"}");
        adminPost("/api/v1/users", Map.of("username", "sheetviewer", "password", "viewer-password-12", "role", "VIEWER"));
        String viewer = login("sheetviewer", "viewer-password-12");
        assertThat(mvc.perform(get("/api/v1/auth/sheet").header("Authorization", "Bearer " + viewer))
            .andReturn().getResponse().getStatus()).isEqualTo(403);
    }
}
