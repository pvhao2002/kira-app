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
import java.util.UUID;

/**
 * Brute-force protection. Only failures count. A user name is locked per (user name, client IP), so a stranger who
 * types wrong passwords for "admin" locks nobody out except themselves; a client IP is blocked after too many failures
 * for any user name. A success clears the (user name, IP) pair; an admin can clear every IP of a user. Password
 * changes have their own per-user failure counter.
 */
// ponytail: in-memory per instance; move to Redis/DB if the API is scaled out and a global limit is needed.
@Component
public class LoginRateLimiter {
    private final FailureWindows ipFailures;
    private final FailureWindows pairFailures;
    private final FailureWindows changeFailures;
    private final int maxFailuresPerIp;
    private final int maxFailuresPerUser;
    private final Clock clock;

    @Autowired
    public LoginRateLimiter(@Value("${app.login-rate-limit.max-attempts-per-ip:30}") int maxFailuresPerIp,
                            @Value("${app.login-rate-limit.ip-window:PT5M}") Duration ipWindow,
                            @Value("${app.login-rate-limit.max-failures-per-user:5}") int maxFailuresPerUser,
                            @Value("${app.login-rate-limit.user-window:PT15M}") Duration userWindow) {
        this(maxFailuresPerIp, ipWindow, maxFailuresPerUser, userWindow, Clock.systemUTC());
    }

    LoginRateLimiter(int maxFailuresPerIp, Duration ipWindow, int maxFailuresPerUser, Duration userWindow, Clock clock) {
        this.maxFailuresPerIp = maxFailuresPerIp;
        this.maxFailuresPerUser = maxFailuresPerUser;
        this.clock = clock;
        this.ipFailures = new FailureWindows(ipWindow, clock);
        this.pairFailures = new FailureWindows(userWindow, clock);
        this.changeFailures = new FailureWindows(userWindow, clock);
    }

    public void acquire(String ip, String username) {
        Instant now = clock.instant();
        String pair = pairKey(ip, username);
        if (pairFailures.count(pair) >= maxFailuresPerUser) throw limited(pairFailures.resetAt(pair), now);
        String ipKey = ipKey(ip);
        if (ipFailures.count(ipKey) >= maxFailuresPerIp) throw limited(ipFailures.resetAt(ipKey), now);
    }

    public void recordFailure(String ip, String username) {
        pairFailures.increment(pairKey(ip, username));
        ipFailures.increment(ipKey(ip));
    }

    public void recordSuccess(String ip, String username) {
        pairFailures.clear(pairKey(ip, username));
    }

    /** Clears the lockout of a user for every client IP (admin action). */
    public void unlock(String username) {
        pairFailures.clearPrefix(userPrefix(username));
    }

    public boolean isLocked(String username) {
        return pairFailures.anyAtLeast(userPrefix(username), maxFailuresPerUser);
    }

    public void acquirePasswordChange(UUID userId) {
        String key = userId.toString();
        if (changeFailures.count(key) >= maxFailuresPerUser) throw limited(changeFailures.resetAt(key), clock.instant());
    }

    public void recordPasswordChangeFailure(UUID userId) {
        changeFailures.increment(userId.toString());
    }

    public void recordPasswordChangeSuccess(UUID userId) {
        changeFailures.clear(userId.toString());
    }

    @Scheduled(fixedDelayString = "PT1M")
    public void evictExpired() {
        ipFailures.evictExpired();
        pairFailures.evictExpired();
        changeFailures.evictExpired();
    }

    private static String ipKey(String ip) {
        return ip == null ? "unknown" : ip;
    }

    /** Length-prefixed so one user name can never be a prefix of another's key. */
    private static String userPrefix(String username) {
        String name = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        return name.length() + ":" + name + "|";
    }

    private static String pairKey(String ip, String username) {
        return userPrefix(username) + ipKey(ip);
    }

    private static ApiException limited(Instant resetAt, Instant now) {
        long seconds = Math.max(1, Duration.between(now, resetAt).toSeconds());
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED",
            "Too many attempts. Try again in " + Math.max(1, (seconds + 59) / 60) + " minute(s)", headers);
    }
}
