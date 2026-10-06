package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import com.kira.farm.shared.security.Hashing;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Forgot/reset/change password. No mail is sent in tests (the Noop notifier is active), so redemption tests insert a
 * token row with a known raw value (only its SHA-256 is ever stored).
 */
class PasswordResetIT extends IntegrationTestBase {
    private static final String NEW_PASSWORD = PASSWORD + "-new"; // NOSONAR test-only value
    private static final String OTHER_PASSWORD = PASSWORD + "-other"; // NOSONAR test-only value

    /** Inserts a token valid for {@code seconds} from now (negative = already expired). */
    private String insertToken(long userId, int seconds) {
        String raw = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) "
            + "VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND),UTC_TIMESTAMP(6))",
            userId, Hashing.sha256Hex(raw), seconds);
        return raw;
    }

    private Res reset(String token, String password) {
        return api.post("/api/v1/auth/password/reset", null, Api.map("token", token, "newPassword", password));
    }

    private int activeRefreshTokens(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE user_id=? AND revoked_at IS NULL",
            Integer.class, userId);
    }

    @Test
    void tokenWorksOnceThenIsRejectedAndOldPasswordStopsWorking() {
        Customer c = newCustomer();
        String token = insertToken(c.id(), 1800);
        assertEquals(204, reset(token, NEW_PASSWORD).status());
        Res again = reset(token, OTHER_PASSWORD);
        assertEquals(400, again.status());
        assertEquals("RESET_TOKEN_INVALID", again.code());
        assertEquals(401, api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", PASSWORD)).status());
        assertEquals(200, api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", NEW_PASSWORD)).status());
    }

    @Test
    void expiredAndUnknownTokensAreRejected() {
        Customer c = newCustomer();
        String expired = insertToken(c.id(), -60);
        assertEquals("RESET_TOKEN_INVALID", reset(expired, NEW_PASSWORD).code());
        assertEquals("RESET_TOKEN_INVALID", reset(UUID.randomUUID().toString(), NEW_PASSWORD).code());
        assertEquals(400, reset(insertToken(c.id(), 1800), "short").status());
    }

    @Test
    void forgotAnswersTheSameForUnknownEmailAndKeepsOnlyTheNewestToken() {
        Customer c = newCustomer();
        Res known = api.post("/api/v1/auth/password/forgot", null, Api.map("email", c.email()));
        Res unknown = api.post("/api/v1/auth/password/forgot", null, Api.map("email", unique("nobody") + "@test.vn"));
        assertEquals(202, known.status());
        assertEquals(202, unknown.status());
        assertEquals(known.json(), unknown.json());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=?", Integer.class, c.id()));
        String firstHash = jdbc.queryForObject("SELECT token_hash FROM password_reset_tokens WHERE user_id=?", String.class, c.id());
        assertEquals(202, api.post("/api/v1/auth/password/forgot", null, Api.map("email", c.email().toUpperCase())).status());
        assertNotEquals(firstHash, jdbc.queryForObject("SELECT token_hash FROM password_reset_tokens WHERE user_id=?", String.class, c.id()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=?", Integer.class, c.id()));
        assertNull(jdbc.queryForObject("SELECT used_at FROM password_reset_tokens WHERE user_id=?", java.sql.Timestamp.class, c.id()));
    }

    @Test
    void forgotIsRateLimitedPerEmail() {
        String email = unique("limited") + "@test.vn";
        for (int i = 0; i < 5; i++) assertEquals(202, api.post("/api/v1/auth/password/forgot", null, Api.map("email", email)).status());
        Res blocked = api.post("/api/v1/auth/password/forgot", null, Api.map("email", email));
        assertEquals(429, blocked.status());
        assertEquals("RESET_RATE_LIMITED", blocked.code());
    }

    @Test
    void resetRevokesEveryRefreshToken() {
        Customer c = newCustomer();
        assertTrue(activeRefreshTokens(c.id()) > 0);
        assertEquals(204, reset(insertToken(c.id(), 1800), NEW_PASSWORD).status());
        assertEquals(0, activeRefreshTokens(c.id()));
    }

    @Test
    void changePasswordRejectsWrongCurrentPasswordAndKeepsOnlyTheCurrentSession() {
        Customer c = newCustomer();
        Res login = api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", PASSWORD));
        String keep = login.cookie("farm_refresh");
        assertNotNull(keep);
        String token = login.str("accessToken");

        Res wrong = api.post("/api/v1/auth/password/change", token, Api.map("currentPassword", OTHER_PASSWORD, "newPassword", NEW_PASSWORD));
        assertEquals(422, wrong.status());
        assertEquals("CURRENT_PASSWORD_INVALID", wrong.code());

        Res ok = api.call(HttpMethod.POST, "/api/v1/auth/password/change", token,
            Api.map("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD), Map.of("Cookie", "farm_refresh=" + keep));
        assertEquals(204, ok.status());
        // the registration session and the other login are revoked; only the session of the cookie survives
        assertEquals(1, activeRefreshTokens(c.id()));
        assertEquals(200, api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", NEW_PASSWORD)).status());
    }

    @Test
    void changePasswordWithoutARefreshCookieRevokesEverySession() {
        Customer c = newCustomer();
        assertTrue(activeRefreshTokens(c.id()) > 0);
        Res ok = api.post("/api/v1/auth/password/change", c.token(),
            Api.map("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD));
        assertEquals(204, ok.status());
        assertEquals(0, activeRefreshTokens(c.id()));
    }
}
