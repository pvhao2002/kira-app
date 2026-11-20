package com.matchmind.shared;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TimeRulesTest {
    private static final Instant NOW = Instant.parse("2026-11-20T12:00:00Z");

    private static Map<String, String> kickOff(String t) {
        Map<String, String> errors = new LinkedHashMap<>();
        TimeRules.checkKickOff(Instant.parse(t), "startTime", NOW, errors);
        return errors;
    }

    private static Map<String, String> observed(String t) {
        Map<String, String> errors = new LinkedHashMap<>();
        TimeRules.checkObserved(Instant.parse(t), "predictedAt", NOW, errors);
        return errors;
    }

    @Test
    void kickOffMustBeBetween2000AndTwoYearsAhead() {
        assertTrue(kickOff("2000-01-01T00:00:00Z").isEmpty());
        assertTrue(kickOff("2028-11-20T12:00:00Z").isEmpty());
        assertTrue(kickOff("1999-12-31T23:59:59Z").containsKey("startTime"));
        assertTrue(kickOff("0001-01-01T00:00:00Z").containsKey("startTime"));
        assertTrue(kickOff("2028-11-20T12:00:01Z").containsKey("startTime"));
        assertTrue(kickOff("+10000-01-01T00:00:00Z").containsKey("startTime"));
    }

    @Test
    void observedTimesMayBeAtMostFiveMinutesAhead() {
        assertTrue(observed("2026-11-20T12:05:00Z").isEmpty());
        assertTrue(observed("2000-01-01T00:00:00Z").isEmpty());
        assertTrue(observed("2026-11-20T12:05:01Z").containsKey("predictedAt"));
        assertTrue(observed("2036-11-20T12:00:00Z").containsKey("predictedAt"));
        assertTrue(observed("1999-12-31T23:59:59Z").containsKey("predictedAt"));
    }

    @Test
    void absentTimesAreNotChecked() {
        Map<String, String> errors = new LinkedHashMap<>();
        TimeRules.checkKickOff(null, "a", NOW, errors);
        TimeRules.checkObserved(null, "b", NOW, errors);
        assertEquals(Map.of(), errors);
    }
}
