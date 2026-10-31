package com.kira.news.identity;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Locks a username for 15 minutes after 5 failed logins. An attempt is counted before the (slow) password check,
 * atomically, so parallel requests cannot all slip through one lock window.
 */
@Component
public class LoginThrottle {
    static final int MAX_FAILURES = 5;
    private static final Duration LOCK = Duration.ofMinutes(15);
    private static final int MAX_TRACKED = 10_000;

    private record Attempts(int count, Instant lockedUntil, Instant lastAttempt) {
    }

    // shortcut: in-memory per instance, resets on restart; move to the DB if the service runs on several nodes.
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    /** Records an attempt; false when the username is locked (the attempt is refused). */
    public boolean tryAcquire(String username) {
        var now = Instant.now();
        if (attempts.size() > MAX_TRACKED) {
            attempts.values().removeIf(entry -> entry.lastAttempt().isBefore(now.minus(LOCK)));
        }
        var entry = attempts.compute(username, (_, old) -> {
            if (old != null && old.lockedUntil() != null && old.lockedUntil().isAfter(now)) {
                return old;
            }
            var count = old == null || old.lockedUntil() != null ? 1 : old.count() + 1;
            return new Attempts(count, count > MAX_FAILURES ? now.plus(LOCK) : null, now);
        });
        return entry.lockedUntil() == null;
    }

    public void succeeded(String username) {
        attempts.remove(username);
    }
}
