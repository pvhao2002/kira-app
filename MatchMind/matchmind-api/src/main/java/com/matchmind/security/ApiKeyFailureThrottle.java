package com.matchmind.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Counts rejected external calls (missing or wrong API key) per client IP per window, so junk-key floods get a 429
 * and write at most one audit row per IP per window instead of one row per request.
 */
// ponytail: in-memory per instance and the skipped attempts are not counted in the log; persist a count if needed.
@Component
public class ApiKeyFailureThrottle {
    private final FailureWindows hits;
    private final int max;

    @Autowired
    public ApiKeyFailureThrottle(@Value("${app.external-rate-limit.max-rejected-per-ip:30}") int max,
                                 @Value("${app.external-rate-limit.window:PT1M}") Duration window) {
        this(max, window, Clock.systemUTC());
    }

    ApiKeyFailureThrottle(int max, Duration window, Clock clock) {
        this.max = max;
        this.hits = new FailureWindows(window, clock);
    }

    /** Counts one rejected call from this IP and returns how many it has made in the current window. */
    public int hit(String ip) {
        return hits.increment(ip == null ? "unknown" : ip);
    }

    public boolean exceeded(int hitCount) {
        return hitCount > max;
    }

    @Scheduled(fixedDelayString = "PT1M")
    void evictExpired() {
        hits.evictExpired();
    }
}
