package com.kira.farm.shared.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Converter for native-query timestamp columns, whose JDBC type varies by driver/dialect. */
public final class Rows {
    private Rows() {
    }

    public static Instant instant(Object o) {
        return switch (o) {
            case null -> null;
            case Instant i -> i;
            case Timestamp t -> t.toInstant();
            case LocalDateTime l -> l.toInstant(ZoneOffset.UTC);
            default -> throw new IllegalArgumentException("Unsupported timestamp type");
        };
    }
}
