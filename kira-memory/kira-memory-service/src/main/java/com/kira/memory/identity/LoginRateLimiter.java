package com.kira.memory.identity;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Failed logins per username: 10 per 15 minutes.
 * ponytail: in-memory and per instance; fine for one instance and two accounts, move to Redis if it ever scales out.
 */
@Component
public class LoginRateLimiter {
    static final int MAX_FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public boolean blocked(String username) {
        Deque<Instant> q = failures.get(username);
        if (q == null) return false;
        synchronized (q) {
            Instant cutoff = Instant.now().minus(WINDOW);
            while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
            return q.size() >= MAX_FAILURES;
        }
    }

    public void failed(String username) {
        Deque<Instant> q = failures.computeIfAbsent(username, k -> new ArrayDeque<>());
        synchronized (q) {
            q.addLast(Instant.now());
        }
    }

    public void succeeded(String username) {
        failures.remove(username);
    }

    /** Whether failures are being remembered for this name (for tests). */
    public boolean tracking(String username) {
        return failures.containsKey(username);
    }
}
