package com.kira.news.identity;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class LoginThrottleTest {
    @Test
    void parallelAttemptsCannotExceedTheLimit() {
        var throttle = new LoginThrottle();
        var allowed = new AtomicInteger();
        IntStream.range(0, 50).parallel().forEach(_ -> {
            if (throttle.tryAcquire("owner")) {
                allowed.incrementAndGet();
            }
        });
        assertThat(allowed.get()).isEqualTo(LoginThrottle.MAX_FAILURES);
    }

    @Test
    void successResetsTheCounter() {
        var throttle = new LoginThrottle();
        IntStream.range(0, LoginThrottle.MAX_FAILURES - 1).forEach(_ -> throttle.tryAcquire("codex"));
        throttle.succeeded("codex");
        assertThat(throttle.tryAcquire("codex")).isTrue();
    }
}
