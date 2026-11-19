package com.matchmind.security;

import com.matchmind.shared.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Brute-force protection for login: every attempt counts against the client IP, every failure counts against the
 * username. A successful login clears the username counter.
 */
// ponytail: in-memory per instance; move to Redis/DB if the API is scaled out and a global limit is needed.
@Component
public class LoginRateLimiter {
    private static final int MAX_TRACKED_KEYS = 100_000;
    private final Map<String, Window> ipAttempts = new ConcurrentHashMap<>();
    private final Map<String, Window> userFailures = new ConcurrentHashMap<>();
    private final int maxPerIp;
    private final Duration ipWindow;
    private final int maxFailuresPerUser;
    private final Duration userWindow;
    private final Clock clock;

    @Autowired
    public LoginRateLimiter(@Value("${app.login-rate-limit.max-attempts-per-ip:20}") int maxPerIp,
                            @Value("${app.login-rate-limit.ip-window:PT5M}") Duration ipWindow,
                            @Value("${app.login-rate-limit.max-failures-per-user:5}") int maxFailuresPerUser,
                            @Value("${app.login-rate-limit.user-window:PT15M}") Duration userWindow) {
        this(maxPerIp, ipWindow, maxFailuresPerUser, userWindow, Clock.systemUTC());
    }

    LoginRateLimiter(int maxPerIp, Duration ipWindow, int maxFailuresPerUser, Duration userWindow, Clock clock) {
        this.maxPerIp = maxPerIp;
        this.ipWindow = ipWindow;
        this.maxFailuresPerUser = maxFailuresPerUser;
        this.userWindow = userWindow;
        this.clock = clock;
    }

    public void acquire(String ip, String username) {
        Instant now = clock.instant();
        Window user = userFailures.get(key(username));
        if (user != null && user.active(now) && user.count() >= maxFailuresPerUser) throw limited(user.resetAt(), now);
        Window ipState = increment(ipAttempts, ip == null ? "unknown" : ip, ipWindow, now);
        if (ipState.count() > maxPerIp) throw limited(ipState.resetAt(), now);
    }

    public void recordFailure(String username) {
        increment(userFailures, key(username), userWindow, clock.instant());
    }

    public void recordSuccess(String username) {
        userFailures.remove(key(username));
    }

    @Scheduled(fixedDelayString = "PT1M")
    public void evictExpired() {
        Instant now = clock.instant();
        ipAttempts.values().removeIf(w -> !w.active(now));
        userFailures.values().removeIf(w -> !w.active(now));
    }

    private Window increment(Map<String, Window> windows, String key, Duration length, Instant now) {
        if (windows.size() >= MAX_TRACKED_KEYS && !windows.containsKey(key)) {
            windows.values().removeIf(w -> !w.active(now));
            if (windows.size() >= MAX_TRACKED_KEYS) return new Window(now.plus(length), Integer.MAX_VALUE);
        }
        return windows.compute(key, (k, cur) -> cur == null || !cur.active(now)
            ? new Window(now.plus(length), 1) : new Window(cur.resetAt(), cur.count() + 1));
    }

    private static String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException limited(Instant resetAt, Instant now) {
        long seconds = Math.max(1, Duration.between(now, resetAt).toSeconds());
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED",
            "Too many login attempts. Try again in " + Math.max(1, (seconds + 59) / 60) + " minute(s)", headers);
    }

    private record Window(Instant resetAt, int count) {
        boolean active(Instant now) {
            return now.isBefore(resetAt);
        }
    }
}
