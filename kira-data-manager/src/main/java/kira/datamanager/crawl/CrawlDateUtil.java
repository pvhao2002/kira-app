package kira.datamanager.crawl;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public final class CrawlDateUtil {

    public static final String DATE_FORMAT_CRAWL = "yyyyMMdd";

    private static final DateTimeFormatter CRAWL_DATE = DateTimeFormatter.ofPattern(DATE_FORMAT_CRAWL);
    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private CrawlDateUtil() {
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
