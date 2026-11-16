package com.kira.affiliate.shared.web;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** Inclusive calendar-day range in Vietnam time, held as a half-open UTC instant range. */
public record DateRange(Instant from, Instant toExclusive) {
    public static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_DAYS = 731;

    /** Missing bounds default to the last 30 days ending today (VN). */
    public static DateRange of(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now(VN);
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "Ngày bắt đầu phải trước ngày kết thúc");
        if (ChronoUnit.DAYS.between(start, end) > MAX_DAYS)
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_RANGE_TOO_LONG", "Khoảng thời gian tối đa là 2 năm");
        return new DateRange(startOf(start), endExclusive(end));
    }

    public static Instant startOf(LocalDate day) {
        return day.atStartOfDay(VN).toInstant();
    }

    public static Instant endExclusive(LocalDate day) {
        return day.plusDays(1).atStartOfDay(VN).toInstant();
    }

    /** DATETIME columns hold UTC wall-clock values; bind them as LocalDateTime so the driver applies no zone shift. */
    public static LocalDateTime utc(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    public static Instant instant(LocalDateTime utc) {
        return utc == null ? null : utc.toInstant(ZoneOffset.UTC);
    }
}
