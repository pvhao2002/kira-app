package com.kira.farm.shared.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Converters for native-query Object[] rows, whose JDBC types vary by driver/dialect. */
public final class Rows {
    private Rows() {
    }

    public static long num(Object o) {
        return o == null ? 0L : ((Number) o).longValue();
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

    public static LocalDate date(Object o) {
        return switch (o) {
            case null -> null;
            case LocalDate d -> d;
            case java.sql.Date d -> d.toLocalDate();
            default -> LocalDate.parse(o.toString());
        };
    }
}
