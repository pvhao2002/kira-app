package kira.producer.util;

import lombok.experimental.UtilityClass;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@UtilityClass
public class DateUtil {

    private static final String DATE_FORMAT_CRAWL = "yyyyMMdd";

    public static String getTodayDate() {
        return LocalDate.now().format(DateTimeFormatter.ofPattern(DATE_FORMAT_CRAWL));
    }

    public static String getTomorrowDate() {
        return LocalDate.now().plusDays(1).format(DateTimeFormatter.ofPattern(DATE_FORMAT_CRAWL));
    }
}
