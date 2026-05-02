package com.db.kiragateway.credit;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Derives next statement/due calendar dates from day-of-month (1–31), clamped to month length.
 */
public final class CreditCardScheduleUtil {

    private CreditCardScheduleUtil() {
    }

    public static LocalDate nextOccurrenceOfDay(LocalDate today, int dayOfMonth) {
        int safeDay = clampDay(today.getYear(), today.getMonthValue(), dayOfMonth);
        LocalDate candidate = LocalDate.of(today.getYear(), today.getMonth(), safeDay);
        if (!candidate.isBefore(today)) {
            return candidate;
        }
        LocalDate nextMonth = today.plusMonths(1);
        int d = clampDay(nextMonth.getYear(), nextMonth.getMonthValue(), dayOfMonth);
        return LocalDate.of(nextMonth.getYear(), nextMonth.getMonth(), d);
    }

    /**
     * Days from today to due date (non-negative). Null if today is after due (overdue shown as 0 or negative in UI — we use max with -1 for overdue).
     */
    public static long daysUntil(LocalDate today, LocalDate target) {
        return ChronoUnit.DAYS.between(today, target);
    }

    public static String formatDdMm(LocalDate date) {
        return String.format("%02d/%02d", date.getDayOfMonth(), date.getMonthValue());
    }

    private static int clampDay(int year, int month, int day) {
        int max = LocalDate.of(year, month, 1).lengthOfMonth();
        return Math.min(Math.max(day, 1), max);
    }
}
