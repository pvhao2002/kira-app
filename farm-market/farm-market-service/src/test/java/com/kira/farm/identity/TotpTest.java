package com.kira.farm.identity;

import com.kira.farm.identity.application.JwtService;
import com.kira.farm.identity.application.LoginRateLimiter;
import com.kira.farm.identity.application.Totp;
import com.kira.farm.identity.application.TotpCrypto;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class TotpTest {
    static final byte[] RFC_KEY = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    @Test
    void rfc6238Sha1Vectors() {
        // RFC 6238 appendix B (8-digit values truncated to the last 6 digits).
        assertEquals("287082", Totp.code(RFC_KEY, Totp.stepAt(59L)));
        assertEquals("081804", Totp.code(RFC_KEY, Totp.stepAt(1111111109L)));
        assertEquals("050471", Totp.code(RFC_KEY, Totp.stepAt(1111111111L)));
        assertEquals("005924", Totp.code(RFC_KEY, Totp.stepAt(1234567890L)));
        assertEquals("279037", Totp.code(RFC_KEY, Totp.stepAt(2000000000L)));
        assertEquals("353130", Totp.code(RFC_KEY, Totp.stepAt(20000000000L)));
    }

    @Test
    void base32RoundTripAndKnownValue() {
        assertEquals("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", Totp.base32(RFC_KEY));
        assertArrayEquals(RFC_KEY, Totp.fromBase32("gezdgnbvgy3tqojqgezdgnbvgy3tqojq"));
        String s = Totp.newSecret();
        assertEquals(32, s.length());
        assertEquals(s, Totp.base32(Totp.fromBase32(s)));
    }

    @Test
    void windowAcceptsPlusMinusOneStepOnly() {
        long now = 1000;
        assertEquals(now, Totp.match(RFC_KEY, now, null, Totp.code(RFC_KEY, now)));
        assertEquals(now - 1, Totp.match(RFC_KEY, now, null, Totp.code(RFC_KEY, now - 1)));
        assertEquals(now + 1, Totp.match(RFC_KEY, now, null, Totp.code(RFC_KEY, now + 1)));
        assertEquals(-1, Totp.match(RFC_KEY, now, null, Totp.code(RFC_KEY, now - 2)));
        assertEquals(-1, Totp.match(RFC_KEY, now, null, Totp.code(RFC_KEY, now + 2)));
    }

    @Test
    void replayAndMalformedCodesAreRejected() {
        long now = 1000;
        String c = Totp.code(RFC_KEY, now);
        assertEquals(-1, Totp.match(RFC_KEY, now, now, c), "same step again is a replay");
        assertEquals(-1, Totp.match(RFC_KEY, now, now + 1, c), "older than last accepted step");
        assertEquals(now + 1, Totp.match(RFC_KEY, now, now, Totp.code(RFC_KEY, now + 1)));
        assertEquals(-1, Totp.match(RFC_KEY, now, null, "12345"));
        assertEquals(-1, Totp.match(RFC_KEY, now, null, "abcdef"));
        assertEquals(-1, Totp.match(RFC_KEY, now, null, null));
    }

    @Test
    void otpauthUriShape() {
        assertEquals("otpauth://totp/Kira%20Farm:a%40b.vn?secret=ABC&issuer=Kira%20Farm",
            Totp.otpauthUri("Kira Farm", "a@b.vn", "ABC"));
    }

    @Test
    void challengeTokenIsNotAnAccessTokenAndViceVersa() {
        JwtService jwt = new JwtService(JwtServiceTest.SECRET, Duration.ofMinutes(15));
        User u = new User();
        u.setId(7L);
        u.setRole(Role.ADMIN);
        u.setBranchIds(Set.of());
        String challenge = jwt.issueChallenge(7L);
        assertEquals(7L, jwt.challengeSubject(challenge));
        assertThrows(RuntimeException.class, () -> jwt.subject(challenge));
        assertThrows(RuntimeException.class, () -> jwt.challengeSubject(jwt.issue(u)));
        assertThrows(RuntimeException.class, () -> jwt.challengeSubject(jwt.issueChallenge(7L, Duration.ofSeconds(-5))));
    }

    @Test
    void secretEncryptionRoundTripAndKeyBinding() {
        TotpCrypto a = new TotpCrypto("a-test-key-that-is-at-least-32-characters");
        String secret = Totp.newSecret();
        String enc = a.encrypt(secret);
        assertNotEquals(secret, enc);
        assertNotEquals(enc, a.encrypt(secret), "random IV per encryption");
        assertEquals(secret, a.decrypt(enc));
        assertThrows(IllegalStateException.class,
            () -> new TotpCrypto("another-key-that-is-at-least-32-chars!!").decrypt(enc));
        assertThrows(IllegalStateException.class, () -> new TotpCrypto("short"));
    }

    @Test
    void otpFailuresAreCappedPerUser() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int i = 0; i < 5; i++) {
            limiter.checkOtp(1L);
            limiter.recordOtpFailure(1L);
        }
        ApiException e = assertThrows(ApiException.class, () -> limiter.checkOtp(1L));
        assertEquals("OTP_RATE_LIMITED", e.getCode());
        limiter.checkOtp(2L);
        limiter.recordOtpSuccess(1L);
        limiter.checkOtp(1L);
    }
}
