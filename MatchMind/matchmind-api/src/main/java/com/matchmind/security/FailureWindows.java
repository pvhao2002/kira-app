package com.matchmind.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Fixed-window counters by key, in memory. A full table refuses new keys (they count as over any limit). */
final class FailureWindows {
    private static final int MAX_TRACKED_KEYS = 100_000;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Duration length;
    private final Clock clock;

    FailureWindows(Duration length, Clock clock) {
        this.length = length;
        this.clock = clock;
    }

    /** Failures counted for the key in its current window, 0 when none. */
    int count(String key) {
        Window w = windows.get(key);
        return w != null && w.active(clock.instant()) ? w.count() : 0;
    }

    Instant resetAt(String key) {
        Window w = windows.get(key);
        return w != null && w.active(clock.instant()) ? w.resetAt() : clock.instant();
    }

    /** Counts one more failure and returns the new count. */
    int increment(String key) {
        Instant now = clock.instant();
        if (windows.size() >= MAX_TRACKED_KEYS && !windows.containsKey(key)) {
            windows.values().removeIf(w -> !w.active(now));
            if (windows.size() >= MAX_TRACKED_KEYS) return Integer.MAX_VALUE;
        }
        return windows.compute(key, (k, cur) -> cur == null || !cur.active(now)
            ? new Window(now.plus(length), 1) : new Window(cur.resetAt(), cur.count() + 1)).count();
    }

    void clear(String key) {
        windows.remove(key);
    }

    void clearPrefix(String prefix) {
        windows.keySet().removeIf(k -> k.startsWith(prefix));
    }

    boolean anyAtLeast(String prefix, int threshold) {
        Instant now = clock.instant();
        return windows.entrySet().stream()
            .anyMatch(e -> e.getKey().startsWith(prefix) && e.getValue().active(now) && e.getValue().count() >= threshold);
    }

    void evictExpired() {
        Instant now = clock.instant();
        windows.values().removeIf(w -> !w.active(now));
    }

    private record Window(Instant resetAt, int count) {
        boolean active(Instant now) {
            return now.isBefore(resetAt);
        }
    }
}
