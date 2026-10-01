package com.kira.farm.it;

import com.kira.farm.identity.application.Totp;
import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AuthIT extends IntegrationTestBase {

    @Test
    void customerLoginIssuesTokensImmediately() {
        Customer c = newCustomer();
        Res r = api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", PASSWORD));
        assertEquals(200, r.status());
        assertFalse(r.str("accessToken").isEmpty());
        assertNotNull(r.cookie("farm_refresh"));
        assertEquals(c.email(), api.get("/api/v1/auth/me", r.str("accessToken")).str("email"));
        assertEquals(401, api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", "wrong-password")).status());
    }

    @Test
    void staffLoginGivesNoTokensUntilOtpIsVerified() {
        String email = newBackoffice("STAFF", Q7);
        Res login = api.post("/api/v1/auth/login", null, Api.map("identifier", email, "password", PASSWORD));
        assertEquals(200, login.status());
        assertTrue(login.json().path("otpRequired").asBoolean());
        assertTrue(login.json().path("enrolled").asBoolean());
        assertTrue(login.json().path("accessToken").isMissingNode());
        assertNull(login.cookie("farm_refresh"), "no refresh cookie before the second factor");
        // The challenge token is not an access token.
        String challenge = login.str("challengeToken");
        assertEquals(401, api.get("/api/v1/auth/me", challenge).status());
        assertEquals(401, api.get("/api/v1/admin/orders", challenge).status());

        Res ok = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", challenge, "code", currentCode()));
        assertEquals(200, ok.status(), ok.json().toString());
        assertEquals("staff", ok.json().path("user").path("role").asText()); // roles are serialized lowercase
        assertEquals(200, api.get("/api/v1/admin/orders", ok.str("accessToken")).status());
    }

    @Test
    void wrongCodeIsRejectedWithOtpInvalid() {
        String email = newBackoffice("STAFF", Q7);
        String challenge = challenge(email);
        long now = Totp.stepAt(Instant.now().getEpochSecond());
        var key = Totp.fromBase32(TOTP_SECRET);
        String bad = "000000";
        for (long s = now - 1; s <= now + 1; s++) if (Totp.code(key, s).equals(bad)) bad = "000001";
        Res r = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", challenge, "code", bad));
        assertEquals(401, r.status());
        assertEquals("OTP_INVALID", r.code());
        Res garbage = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", "not-a-jwt", "code", currentCode()));
        assertEquals(401, garbage.status());
        assertEquals("OTP_INVALID", garbage.code());
    }

    @Test
    void acceptedCodeCannotBeReplayedButANewerStepWorks() {
        String email = newBackoffice("STAFF", Q7);
        long now = Totp.stepAt(Instant.now().getEpochSecond());
        var key = Totp.fromBase32(TOTP_SECRET);

        Res first = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", challenge(email), "code", currentCode()));
        assertEquals(200, first.status());
        Long last = jdbc.queryForObject("SELECT totp_last_step FROM users WHERE email=?", Long.class, email);
        assertNotNull(last);

        // Same code again with a fresh challenge: the step was consumed.
        Res replay = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", challenge(email), "code", Totp.code(key, last)));
        assertEquals(401, replay.status());
        assertEquals("OTP_INVALID", replay.code());

        // A strictly newer step inside the +-1 window is accepted (the replay rule is "> last step").
        if (last <= now) {
            Res next = api.post("/api/v1/auth/otp/verify", null,
                Api.map("challengeToken", challenge(email), "code", Totp.code(key, last + 1)));
            assertEquals(200, next.status(), next.json().toString());
        }
    }

    @Test
    void refreshRotatesTheTokenAndReuseIsRejected() {
        Customer c = newCustomer();
        Res login = api.post("/api/v1/auth/login", null, Api.map("identifier", c.email(), "password", PASSWORD));
        String old = login.cookie("farm_refresh");

        Res refreshed = api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "farm_refresh=" + old));
        assertEquals(200, refreshed.status(), refreshed.json().toString());
        String rotated = refreshed.cookie("farm_refresh");
        assertNotNull(rotated);
        assertNotEquals(old, rotated);
        assertEquals(200, api.get("/api/v1/auth/me", refreshed.str("accessToken")).status());

        Res reuse = api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "farm_refresh=" + old));
        assertEquals(401, reuse.status());
        assertEquals("INVALID_REFRESH_TOKEN", reuse.code());
        // Reuse of a revoked token revokes the whole family, so the rotated token is dead too.
        assertEquals(401, api.post("/api/v1/auth/refresh", null, null, Map.of("Cookie", "farm_refresh=" + rotated)).status());
    }
}
