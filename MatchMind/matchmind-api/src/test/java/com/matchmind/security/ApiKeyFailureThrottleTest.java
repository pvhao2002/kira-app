package com.matchmind.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class ApiKeyFailureThrottleTest {
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

    @Test
    void countsPerIpPerWindowAndResets() {
        MutableClock clock = new MutableClock();
        ApiKeyFailureThrottle t = new ApiKeyFailureThrottle(3, Duration.ofMinutes(1), clock);
        assertThat(t.hit("1.1.1.1")).isEqualTo(1);
        assertThat(t.hit("1.1.1.1")).isEqualTo(2);
        assertThat(t.hit("2.2.2.2")).isEqualTo(1);
        assertThat(t.hit("1.1.1.1")).isEqualTo(3);
        assertThat(t.exceeded(4)).isTrue();
        assertThat(t.exceeded(3)).isFalse();
        clock.now = clock.now.plusSeconds(61);
        assertThat(t.hit("1.1.1.1")).isEqualTo(1);
    }
}
