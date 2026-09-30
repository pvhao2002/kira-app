package com.kira.bank.identity.application;

import com.kira.bank.shared.web.ApiException;
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
 * In-memory brute-force protection for the password login endpoints (web and mobile).
 * <p>
 * Two fixed windows are enforced: every attempt counts against the client IP, and every failed attempt counts
 * against the (normalized) email so a distributed attack on one account is also slowed down. A successful login
 * clears the email counter. State is per instance; when the service is scaled out each instance applies its own
 * limits, which still bounds the total guess rate.
 */
@Component
public class LoginRateLimiter {
    /**
     * Hard cap on tracked keys so a flood of random IPs/emails cannot exhaust memory.
     */
    private static final int MAX_TRACKED_KEYS = 100_000;

    private final Map<String, Window> ipAttempts = new ConcurrentHashMap<>();
    private final Map<String, Window> emailFailures = new ConcurrentHashMap<>();
    private final int maxAttemptsPerIp;
    private final Duration ipWindow;
    private final int maxFailuresPerEmail;
    private final Duration emailWindow;
    private final Clock clock;

    public LoginRateLimiter(@Value("${app.login-rate-limit.max-attempts-per-ip:20}") int maxAttemptsPerIp,
                            @Value("${app.login-rate-limit.ip-window:PT5M}") Duration ipWindow,
                            @Value("${app.login-rate-limit.max-failures-per-email:5}") int maxFailuresPerEmail,
                            @Value("${app.login-rate-limit.email-window:PT15M}") Duration emailWindow) {
        this(maxAttemptsPerIp, ipWindow, maxFailuresPerEmail, emailWindow, Clock.systemUTC());
    }

    LoginRateLimiter(int maxAttemptsPerIp, Duration ipWindow, int maxFailuresPerEmail, Duration emailWindow,
                     Clock clock) {
        if (maxAttemptsPerIp < 1 || maxFailuresPerEmail < 1 || ipWindow.isNegative() || ipWindow.isZero()
            || emailWindow.isNegative() || emailWindow.isZero()) {
            throw new IllegalStateException("app.login-rate-limit limits and windows must be positive");
        }
        this.maxAttemptsPerIp = maxAttemptsPerIp;
        this.ipWindow = ipWindow;
        this.maxFailuresPerEmail = maxFailuresPerEmail;
        this.emailWindow = emailWindow;
        this.clock = clock;
    }

    /**
     * Rejects the attempt with 429 when either limit is exhausted; otherwise counts it against the client IP.
     */
    public void acquire(String clientIp, String email) {
        Instant now = clock.instant();
        Window emailState = emailFailures.get(key(email));
        if (emailState != null && emailState.active(now) && emailState.count() >= maxFailuresPerEmail) {
            throw limited(emailState.resetAt(), now);
        }
        Window ipState = increment(ipAttempts, clientIp == null ? "unknown" : clientIp, ipWindow, now);
        if (ipState.count() > maxAttemptsPerIp) throw limited(ipState.resetAt(), now);
    }

    public void recordFailure(String email) {
        increment(emailFailures, key(email), emailWindow, clock.instant());
    }

    public void recordSuccess(String email) {
        emailFailures.remove(key(email));
    }

    @Scheduled(fixedDelayString = "${app.login-rate-limit.cleanup-interval:PT1M}")
    public void evictExpired() {
        Instant now = clock.instant();
        ipAttempts.values().removeIf(window -> !window.active(now));
        emailFailures.values().removeIf(window -> !window.active(now));
    }

    private Window increment(Map<String, Window> windows, String key, Duration length, Instant now) {
        if (windows.size() >= MAX_TRACKED_KEYS && !windows.containsKey(key)) {
            windows.values().removeIf(window -> !window.active(now));
        }
        return windows.compute(key, (ignored, current) -> current == null || !current.active(now)
            ? new Window(now.plus(length), 1)
            : new Window(current.resetAt(), current.count() + 1));
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException limited(Instant resetAt, Instant now) {
        long seconds = Math.max(1, Duration.between(now, resetAt).toSeconds());
        long minutes = Math.max(1, (seconds + 59) / 60);
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED",
            "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau " + minutes + " phút", headers);
    }

    private record Window(Instant resetAt, int count) {
        boolean active(Instant now) {
            return now.isBefore(resetAt);
        }
    }
}
