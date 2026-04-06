package com.db.kiragateway.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.List;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DateUtil {

    private static final Logger log = Logger.getLogger(DateUtil.class.getName());

    private DateUtil() {}

    private static final List<DateTimeFormatter> ODD_DATE_FORMATTERS = List.of(
            new DateTimeFormatterBuilder()
                    .parseCaseInsensitive()
                    .appendPattern("h:mm a EEEE, MMMM d, yyyy")
                    .toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder()
                    .parseCaseInsensitive()
                    .appendPattern("h:mm a EEE, MMM d, yyyy")
                    .toFormatter(Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h:mm a EEEE, MMMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h:mm a EEE, MMM d, yyyy", Locale.ENGLISH)
    );

    public static LocalDateTime parseOddDate(String oddDate, LocalDateTime defaultDate) {
        for (DateTimeFormatter fmt : ODD_DATE_FORMATTERS) {
            try {
                return LocalDateTime.parse(oddDate, fmt);
            } catch (Exception exp) {
                log.log(Level.FINE, "Failed to parse odd date: " + oddDate);
            }
        }
        return defaultDate;
    }
}
