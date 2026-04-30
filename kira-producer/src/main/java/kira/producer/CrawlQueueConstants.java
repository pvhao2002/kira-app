package kira.producer;

/**
 * Mirrors {@code com.app.kira.util.PlaywrightUtil} queue_type values used in DB.
 */
public final class CrawlQueueConstants {

    public static final String CRAWL_UPCOMING_EVENT = "CRAWL_UPCOMING_EVENT";
    public static final String UPCOMING_QUEUE_MARKER = "upcoming_queue";
    public static final String RETRY_MAIN = "main";
    public static final String RETRY_STATS = "stats";
    public static final String RETRY_ODDS = "odds";

    private CrawlQueueConstants() {
    }
}
