package kira.producer.util;

import lombok.experimental.UtilityClass;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@UtilityClass
public class DateUtil {

    public static final String DATE_FORMAT_CRAWL = "yyyyMMdd";

    private static final ZoneId HCM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter CRAWL_DATE = DateTimeFormatter.ofPattern(DATE_FORMAT_CRAWL);
    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    public static String getTodayDate() {
        return LocalDate.now(HCM_ZONE).format(CRAWL_DATE);
    }

    public static String getTomorrowDate() {
        return LocalDate.now(HCM_ZONE).plusDays(1).format(CRAWL_DATE);
    }

    public static LocalDate parseCrawlInputDate(String date) {
        String d = date == null ? "" : date.trim();
        if (d.matches("\\d{8}")) {
            return LocalDate.parse(d, CRAWL_DATE);
        }
        if (d.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return LocalDate.parse(d, ISO_DATE);
        }
        throw new IllegalArgumentException("date must be yyyy-MM-dd or yyyyMMdd");
    }

    public static String toCrawlDateFormat(String date) {
        return formatCrawlDate(parseCrawlInputDate(date));
    }

    public static String formatCrawlDate(LocalDate date) {
        return date.format(CRAWL_DATE);
    }
}
