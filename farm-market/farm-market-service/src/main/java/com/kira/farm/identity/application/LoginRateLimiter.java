package com.kira.farm.identity.application;

import com.kira.farm.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/** Blocks credential stuffing per identifier. ponytail: in-memory per instance; move to Redis when running >1 replica. */
@Component
public class LoginRateLimiter {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int OTP_MAX_FAILURES = 5;
    private static final Duration OTP_WINDOW = Duration.ofMinutes(5);
    private final ConcurrentHashMap<Long, Deque<Instant>> otpFailures = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public void check(String identifier) {
        Deque<Instant> q = failures.get(key(identifier));
        if (q == null) return;
        synchronized (q) {
            prune(q);
            if (q.size() >= MAX_FAILURES)
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Bạn đã thử quá nhiều lần, vui lòng thử lại sau ít phút");
        }
    }

    public void recordFailure(String identifier) {
        Deque<Instant> q = failures.computeIfAbsent(key(identifier), k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            q.addLast(Instant.now());
        }
    }

    public void recordSuccess(String identifier) {
        failures.remove(key(identifier));
    }

    /** OTP attempts are capped per user id: 5 failures within 5 minutes. */
    public void checkOtp(Long userId) {
        Deque<Instant> q = otpFailures.get(userId);
        if (q == null) return;
        synchronized (q) {
            pruneOtp(q);
            if (q.size() >= OTP_MAX_FAILURES)
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_RATE_LIMITED",
                    "Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút");
        }
    }

    public void recordOtpFailure(Long userId) {
        Deque<Instant> q = otpFailures.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (q) {
            pruneOtp(q);
            q.addLast(Instant.now());
        }
    }

    public void recordOtpSuccess(Long userId) {
        otpFailures.remove(userId);
    }

    private static void pruneOtp(Deque<Instant> q) {
        Instant cutoff = Instant.now().minus(OTP_WINDOW);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
    }

    private static void prune(Deque<Instant> q) {
        Instant cutoff = Instant.now().minus(WINDOW);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
    }

    private static String key(String identifier) {
        return identifier.trim().toLowerCase(Locale.ROOT);
    }
}
