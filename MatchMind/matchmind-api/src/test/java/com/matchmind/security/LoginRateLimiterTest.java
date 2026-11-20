package com.matchmind.security;

import com.matchmind.shared.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginRateLimiterTest {
    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        @Override
        public java.time.ZoneId getZone() {
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

    private final MutableClock clock = new MutableClock();
    // 3 failures per IP in 5 minutes, 2 failures per (user, IP) in 15 minutes.
    private final LoginRateLimiter limiter = new LoginRateLimiter(3, Duration.ofMinutes(5), 2, Duration.ofMinutes(15), clock);

    @Test
    void failuresFromOneIpNeverLockTheSameUserOutFromAnotherIp() {
        limiter.recordFailure("203.0.113.1", "admin");
        limiter.recordFailure("203.0.113.1", "admin");
        assertThatThrownBy(() -> limiter.acquire("203.0.113.1", "admin"))
            .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("LOGIN_RATE_LIMITED"));
        // The real admin signs in from elsewhere: not locked (UX-043).
        assertThatCode(() -> limiter.acquire("198.51.100.7", "admin")).doesNotThrowAnyException();
    }

    @Test
    void successfulLoginsAreNeverCountedAgainstTheIp() {
        for (int i = 0; i < 50; i++) {
            limiter.acquire("203.0.113.1", "u" + i);
            limiter.recordSuccess("203.0.113.1", "u" + i);
        }
        assertThatCode(() -> limiter.acquire("203.0.113.1", "someone")).doesNotThrowAnyException(); // UX-074
    }

    @Test
    void ipIsBlockedOnlyAfterTooManyFailures() {
        limiter.recordFailure("203.0.113.1", "a");
        limiter.recordFailure("203.0.113.1", "b");
        limiter.recordFailure("203.0.113.1", "c");
        assertThatThrownBy(() -> limiter.acquire("203.0.113.1", "d")).isInstanceOf(ApiException.class);
        assertThatCode(() -> limiter.acquire("203.0.113.2", "d")).doesNotThrowAnyException();
    }

    @Test
    void windowExpiresAndSuccessClearsThePair() {
        limiter.recordFailure("203.0.113.1", "Admin");
        limiter.recordFailure("203.0.113.1", "admin"); // user names compare case-insensitively
        assertThatThrownBy(() -> limiter.acquire("203.0.113.1", "ADMIN")).isInstanceOf(ApiException.class);
        clock.now = clock.now.plus(Duration.ofMinutes(16));
        assertThatCode(() -> limiter.acquire("203.0.113.1", "admin")).doesNotThrowAnyException();
        limiter.recordFailure("203.0.113.1", "admin");
        limiter.recordSuccess("203.0.113.1", "admin");
        limiter.recordFailure("203.0.113.1", "admin");
        assertThatCode(() -> limiter.acquire("203.0.113.1", "admin")).doesNotThrowAnyException();
    }

    @Test
    void adminUnlockClearsEveryIpOfThatUserOnly() {
        for (String ip : new String[]{"203.0.113.1", "203.0.113.2"}) {
            limiter.recordFailure(ip, "bob");
            limiter.recordFailure(ip, "bob");
        }
        limiter.recordFailure("203.0.113.1", "carol");
        limiter.recordFailure("203.0.113.1", "carol");
        assertThat(limiter.isLocked("bob")).isTrue();
        limiter.unlock("bob");
        assertThat(limiter.isLocked("bob")).isFalse();
        assertThat(limiter.isLocked("carol")).isTrue();
        assertThatCode(() -> limiter.acquire("203.0.113.2", "bob")).doesNotThrowAnyException();
    }

    @Test
    void changePasswordAttemptsAreLimitedPerUser() {
        UUID user = UUID.randomUUID();
        limiter.acquirePasswordChange(user);
        limiter.recordPasswordChangeFailure(user);
        limiter.recordPasswordChangeFailure(user);
        assertThatThrownBy(() -> limiter.acquirePasswordChange(user)).isInstanceOfSatisfying(ApiException.class,
            e -> assertThat(e.getStatus().value()).isEqualTo(429));
        assertThatCode(() -> limiter.acquirePasswordChange(UUID.randomUUID())).doesNotThrowAnyException();
        limiter.recordPasswordChangeSuccess(user);
        assertThatCode(() -> limiter.acquirePasswordChange(user)).doesNotThrowAnyException();
    }
}
