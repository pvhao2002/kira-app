package com.kira.memory.shared;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** DATETIME columns hold UTC wall time; going through LocalDateTime keeps that independent of the JDBC time zone. */
public final class Utc {
    private Utc() {
    }

    public static LocalDateTime db(Instant instant) {
        return LocalDateTime.ofInstant(instant.truncatedTo(ChronoUnit.MILLIS), ZoneOffset.UTC);
    }

    public static LocalDateTime now() {
        return db(Instant.now());
    }

    public static Instant instant(LocalDateTime dbValue) {
        return dbValue == null ? null : dbValue.toInstant(ZoneOffset.UTC);
    }
}
