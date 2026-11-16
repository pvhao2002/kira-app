package com.kira.affiliate.it;

import com.kira.affiliate.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AuthIT extends IntegrationTestBase {
    @Test
    void registerLoginProfileAndValidation() {
        TestUser user = newUser();
        Res profile = api.get("/api/v1/auth/profile", user.token());
        assertEquals(200, profile.status());
        assertEquals(user.email(), profile.str("email"));
        assertFalse(profile.json().toString().contains("password"));

        assertEquals(409, api.post("/api/v1/auth/register", null,
            Api.map("email", user.email(), "password", PASSWORD, "fullName", "X")).status());
        assertEquals(400, api.post("/api/v1/auth/register", null,
            Api.map("email", "bad", "password", "short", "fullName", "")).status());

        Res wrong = api.post("/api/v1/auth/login", null, Api.map("email", user.email(), "password", "wrong-password"));
        assertEquals(401, wrong.status());
        assertEquals("BAD_CREDENTIALS", wrong.code());
        Res unknown = api.post("/api/v1/auth/login", null, Api.map("email", "nobody@test.vn", "password", "wrong-password"));
        assertEquals("BAD_CREDENTIALS", unknown.code(), "unknown email is indistinguishable from a wrong password");
        assertEquals(200, api.post("/api/v1/auth/login", null, Api.map("email", user.email(), "password", PASSWORD)).status());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email=? AND password_hash LIKE '$2%'",
            Integer.class, user.email()), "password stored as bcrypt");
    }

    @Test
    void everyApiNeedsAToken() {
        for (String path : new String[]{"/api/v1/auth/profile", "/api/v1/links", "/api/v1/orders", "/api/v1/campaigns",
            "/api/v1/reports/summary", "/api/v1/shopee/credentials", "/api/v1/sync/status", "/api/v1/validations",
            "/api/v1/links/export", "/api/v1/orders/export", "/api/v1/orders/1"}) {
            assertEquals(401, api.get(path, null).status(), path);
            assertEquals(401, api.get(path, "not.a.jwt").status(), path);
        }
        assertEquals(401, api.post("/api/v1/links/convert", null, Api.map("urls", java.util.List.of("https://shopee.vn/x"))).status());
        assertEquals(401, api.post("/api/v1/sync", null, null).status());
    }

    @Test
    void refreshRotatesAndReuseRevokesTheFamily() {
        TestUser user = newUser();
        Res rotated = api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "kaff_refresh=" + user.refreshCookie()));
        assertEquals(200, rotated.status(), rotated.json().toString());
        String next = rotated.cookie("kaff_refresh");
        assertNotEquals(user.refreshCookie(), next);
        // Replaying the old token is treated as theft: it fails and the whole family is revoked.
        assertEquals(401, api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "kaff_refresh=" + user.refreshCookie())).status());
        assertEquals(401, api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "kaff_refresh=" + next)).status());
    }

    @Test
    void changingPasswordEndsOtherSessions() {
        TestUser user = newUser();
        assertEquals(204, api.post("/api/v1/auth/change-password", user.token(),
            Api.map("currentPassword", PASSWORD, "newPassword", "NewPassw0rd!x")).status());
        assertEquals(401, api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "kaff_refresh=" + user.refreshCookie())).status());
        assertEquals(401, api.post("/api/v1/auth/login", null, Api.map("email", user.email(), "password", PASSWORD)).status());
        assertEquals(200, api.post("/api/v1/auth/login", null, Api.map("email", user.email(), "password", "NewPassw0rd!x")).status());
    }
}
