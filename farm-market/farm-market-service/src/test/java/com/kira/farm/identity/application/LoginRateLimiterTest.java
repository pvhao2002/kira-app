package com.kira.farm.identity.application;

import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class LoginRateLimiterTest {
    /** Mutable clock so windows can expire without sleeping. */
    private static final class TestClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final TestClock clock = new TestClock();

    @Test
    void blocksAfterFiveFailuresAndUnblocksWhenWindowPasses() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 4; i++) limiter.recordFailure("A@x.vn");
        assertDoesNotThrow(() -> limiter.check("a@x.vn"));
        limiter.recordFailure(" a@X.vn ");
        var e = assertThrows(ApiException.class, () -> limiter.check("a@x.vn"));
        assertEquals("TOO_MANY_ATTEMPTS", e.getCode());
        clock.advance(Duration.ofMinutes(16));
        assertDoesNotThrow(() -> limiter.check("a@x.vn"));
    }

    @Test
    void successResetsAndOtpHasItsOwnLimit() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 5; i++) limiter.recordOtpFailure(7L);
        assertEquals("OTP_RATE_LIMITED", assertThrows(ApiException.class, () -> limiter.checkOtp(7L)).getCode());
        assertDoesNotThrow(() -> limiter.checkOtp(8L));
        limiter.recordOtpSuccess(7L);
        assertDoesNotThrow(() -> limiter.checkOtp(7L));
        assertEquals(0, limiter.trackedKeys());
    }

    @Test
    void expiredEntriesAreSweptSoTheMapDoesNotGrowForever() {
        var limiter = new LoginRateLimiter(clock, 1_000);
        for (int i = 0; i < 500; i++) limiter.recordFailure("user" + i);
        assertEquals(500, limiter.trackedKeys());
        clock.advance(Duration.ofMinutes(20)); // every window expired, sweep interval passed
        limiter.recordFailure("fresh");
        assertEquals(1, limiter.trackedKeys());
    }

    @Test
    void floodOfDistinctIdentifiersIsCappedAndKeepsTheNewest() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 1_000; i++) {
            clock.advance(Duration.ofMillis(1));
            limiter.recordFailure("flood" + i);
        }
        assertTrue(limiter.trackedKeys() <= 100, "tracked " + limiter.trackedKeys());
        // the most recent attacker/victim identifier is still tracked: five more failures block it
        for (int i = 0; i < 5; i++) limiter.recordFailure("flood999");
        assertThrows(ApiException.class, () -> limiter.check("flood999"));
    }

    @Test
    void forgotIsCappedPerEmailAndWindowExpires() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 5; i++) limiter.checkForgot(" A@x.vn");
        assertEquals("RESET_RATE_LIMITED", assertThrows(ApiException.class, () -> limiter.checkForgot("a@x.vn")).getCode());
        assertDoesNotThrow(() -> limiter.checkForgot("b@x.vn"));
        clock.advance(Duration.ofMinutes(16));
        assertDoesNotThrow(() -> limiter.checkForgot("a@x.vn"));
    }

    @Test
    void uploadIsCappedAtTwentyPerUserPerWindow() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 20; i++) limiter.checkUpload(7L);
        assertEquals("UPLOAD_RATE_LIMITED", assertThrows(ApiException.class, () -> limiter.checkUpload(7L)).getCode());
        assertDoesNotThrow(() -> limiter.checkUpload(8L));
        clock.advance(Duration.ofMinutes(11));
        assertDoesNotThrow(() -> limiter.checkUpload(7L));
    }

    @Test
    void forgotFloodIsBounded() {
        var limiter = new LoginRateLimiter(clock, 100);
        for (int i = 0; i < 1_000; i++) {
            clock.advance(Duration.ofMillis(1));
            limiter.checkForgot("flood" + i);
        }
        assertTrue(limiter.trackedKeys() <= 100, "tracked " + limiter.trackedKeys());
    }
}
