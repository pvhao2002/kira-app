package kira.crawl.app.util;

import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.List;
import java.util.Locale;
import java.util.logging.Level;

@Log
@UtilityClass
public class DateUtil {

    private static final ZoneId HCM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

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

    public static LocalDateTime convertToHCM(String isoDate) {
        ZonedDateTime zdt = ZonedDateTime.parse(isoDate, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        ZonedDateTime hcmTime = zdt.withZoneSameInstant(HCM_ZONE);
        return hcmTime.toLocalDateTime();
    }

    public LocalDateTime parseOddDate(String oddDate, LocalDateTime defaultDate) {
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
