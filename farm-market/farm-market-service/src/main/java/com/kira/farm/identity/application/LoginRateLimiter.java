package com.kira.farm.identity.application;

import com.kira.farm.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Request throttle: credential stuffing per identifier, wrong current-password attempts, OTP guessing per user,
 * forgot-password requests per email and image uploads per user. checkForgot/checkUpload also record the hit.
 * ponytail: in-memory per instance; move to Redis
 * when running >1 replica. Memory is bounded: expired windows are swept at most once a minute, and if a flood of
 * distinct identifiers still fills the map, the least recently failing entries are evicted.
 */
@Component
public class LoginRateLimiter {
    static final int DEFAULT_MAX_KEYS = 50_000;
    private final FailureWindow<String> login;
    private final FailureWindow<Long> pwChange;
    private final FailureWindow<Long> otp;
    private final FailureWindow<String> forgot;
    private final FailureWindow<Long> upload;

    public LoginRateLimiter() {
        this(Clock.systemUTC(), DEFAULT_MAX_KEYS);
    }

    LoginRateLimiter(Clock clock, int maxKeys) {
        this.login = new FailureWindow<>(clock, 5, Duration.ofMinutes(15), maxKeys);
        this.pwChange = new FailureWindow<>(clock, 5, Duration.ofMinutes(15), maxKeys);
        this.otp = new FailureWindow<>(clock, 5, Duration.ofMinutes(5), maxKeys);
        this.forgot = new FailureWindow<>(clock, 5, Duration.ofMinutes(15), maxKeys);
        this.upload = new FailureWindow<>(clock, 20, Duration.ofMinutes(10), maxKeys);
    }

    public void check(String identifier) {
        if (login.blocked(key(identifier)))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                "Bạn đã thử quá nhiều lần, vui lòng thử lại sau ít phút");
    }

    public void recordFailure(String identifier) {
        login.record(key(identifier));
    }

    public void recordSuccess(String identifier) {
        login.clear(key(identifier));
    }

    /** Wrong current passwords on change-password: 5 failures per 15 minutes per user id (separate from login keys). */
    public void checkPasswordChange(Long userId) {
        if (pwChange.blocked(userId))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                "Bạn đã thử quá nhiều lần, vui lòng thử lại sau ít phút");
    }

    public void recordPasswordChangeFailure(Long userId) {
        pwChange.record(userId);
    }

    public void recordPasswordChangeSuccess(Long userId) {
        pwChange.clear(userId);
    }

    /** OTP attempts are capped per user id: 5 failures within 5 minutes. */
    public void checkOtp(Long userId) {
        if (otp.blocked(userId))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_RATE_LIMITED",
                "Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút");
    }

    public void recordOtpFailure(Long userId) {
        otp.record(userId);
    }

    public void recordOtpSuccess(Long userId) {
        otp.clear(userId);
    }

    /**
     * Forgot-password requests are capped per email: 5 per 15 minutes, counted whether or not the account exists, so
     * the 429 reveals nothing. Every call counts as one request.
     */
    public void checkForgot(String email) {
        String k = key(email);
        if (forgot.blocked(k))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESET_RATE_LIMITED",
                "Bạn đã yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút");
        forgot.record(k);
    }

    /** Image uploads are capped per user: 20 per 10 minutes. Every call counts as one upload attempt. */
    public void checkUpload(Long userId) {
        if (upload.blocked(userId))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "UPLOAD_RATE_LIMITED",
                "Bạn tải ảnh quá nhanh, vui lòng thử lại sau ít phút");
        upload.record(userId);
    }

    /** Number of tracked identifiers (login + password change + OTP + forgot + upload); for tests and diagnostics. */
    int trackedKeys() {
        return login.size() + pwChange.size() + otp.size() + forgot.size() + upload.size();
    }

    private static String key(String identifier) {
        return identifier.trim().toLowerCase(Locale.ROOT);
    }

    /** Sliding window of failure timestamps per key, with bounded memory. */
    private static final class FailureWindow<K> {
        private static final long SWEEP_EVERY_MILLIS = 60_000;
        private final ConcurrentHashMap<K, Deque<Instant>> failures = new ConcurrentHashMap<>();
        private final AtomicLong lastSweepMillis;
        private final Clock clock;
        private final int maxFailures;
        private final Duration window;
        private final int maxKeys;

        FailureWindow(Clock clock, int maxFailures, Duration window, int maxKeys) {
            this.clock = clock;
            this.maxFailures = maxFailures;
            this.window = window;
            this.maxKeys = maxKeys;
            this.lastSweepMillis = new AtomicLong(clock.millis());
        }

        boolean blocked(K key) {
            Deque<Instant> q = failures.get(key);
            if (q == null) return false;
            synchronized (q) {
                prune(q);
                return q.size() >= maxFailures;
            }
        }

        void record(K key) {
            maintain();
            failures.compute(key, (k, q) -> {
                Deque<Instant> d = q == null ? new ArrayDeque<>() : q;
                synchronized (d) {
                    prune(d);
                    d.addLast(clock.instant());
                }
                return d;
            });
        }

        void clear(K key) {
            failures.remove(key);
        }

        int size() {
            return failures.size();
        }

        private void prune(Deque<Instant> q) {
            Instant cutoff = clock.instant().minus(window);
            while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
        }

        /** Drops expired windows (at most once a minute) and, if still over the cap, the stalest entries. */
        private void maintain() {
            long now = clock.millis();
            long last = lastSweepMillis.get();
            boolean due = now - last >= SWEEP_EVERY_MILLIS && lastSweepMillis.compareAndSet(last, now);
            if (!due && failures.size() < maxKeys) return;
            failures.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    prune(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
            int keep = maxKeys - Math.max(1, maxKeys / 10);
            if (failures.size() >= maxKeys) {
                failures.entrySet().stream()
                    .sorted(Comparator.comparing((Map.Entry<K, Deque<Instant>> e) -> lastFailure(e.getValue())))
                    .limit(failures.size() - keep)
                    .map(Map.Entry::getKey).toList()
                    .forEach(failures::remove);
            }
        }

        private static Instant lastFailure(Deque<Instant> q) {
            synchronized (q) {
                return q.isEmpty() ? Instant.MIN : q.peekLast();
            }
        }
    }
}
