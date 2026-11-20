package com.matchmind.shared;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * The one time window for every timestamp an agent sends. Only ISO-8601 strings with an offset are bound at all
 * (see {@link JacksonConfig}); these checks then keep each value inside a range the database and browsers handle.
 * <ul>
 *   <li>Kick-off times ({@code startTime}): from 2000-01-01T00:00Z up to now + 2 years.</li>
 *   <li>Observed times ({@code predictedAt}, {@code capturedAt}, {@code resultAt}): from 2000-01-01T00:00Z up to now + 5
 *   minutes of clock skew.</li>
 * </ul>
 */
public final class TimeRules {
    public static final Instant EARLIEST = Instant.parse("2000-01-01T00:00:00Z");
    public static final int MAX_YEARS_AHEAD = 2;
    public static final Duration CLOCK_SKEW = Duration.ofMinutes(5);

    private TimeRules() {
    }

    /** Adds a field error when a kick-off time is outside [2000-01-01, now + 2 years]. Null is not checked. */
    public static void checkKickOff(Instant t, String field, Instant now, Map<String, String> errors) {
        Instant latest = now.atOffset(ZoneOffset.UTC).plusYears(MAX_YEARS_AHEAD).toInstant();
        if (t != null && (t.isBefore(EARLIEST) || t.isAfter(latest))) {
            errors.put(field, "must be an ISO-8601 time between " + EARLIEST + " and " + latest + " (now + 2 years)");
        }
    }

    /** Adds a field error when an observed time is before 2000 or more than 5 minutes in the future. Null is not checked. */
    public static void checkObserved(Instant t, String field, Instant now, Map<String, String> errors) {
        if (t != null && (t.isBefore(EARLIEST) || t.isAfter(now.plus(CLOCK_SKEW)))) {
            errors.put(field, "must be an ISO-8601 time between " + EARLIEST + " and now (+5 minutes clock skew)");
        }
    }
}
