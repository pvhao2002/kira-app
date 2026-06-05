package kira.datamanager.event;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Set;

@Repository
public class EventCrawlFailedRepository {

    private static final Set<String> ALLOWED_SORT_BY = Set.of("created_at", "event_date");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");

    private final JdbcClient jdbcClient;

    public EventCrawlFailedRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public static boolean isAllowedSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return true;
        }
        return ALLOWED_SORT_BY.contains(sortBy.trim().toLowerCase(Locale.ROOT));
    }

    public static boolean isAllowedSortDir(String sortDir) {
        if (sortDir == null || sortDir.isBlank()) {
            return true;
        }
        return ALLOWED_SORT_DIR.contains(sortDir.trim().toLowerCase(Locale.ROOT));
    }

    public EventCrawlFailedPageResponse findPage(int page, int size, String sortBy, String sortDir) {
        var orderBy = resolveOrderBy(sortBy, sortDir);

        var countSql = "SELECT COUNT(*) FROM event_crawl_failed";
        var total = jdbcClient.sql(countSql)
                .query((rs, rowNum) -> rs.getLong(1))
                .single();

        var dataSql = """
                SELECT f.event_id,
                       f.type,
                       f.message,
                       f.screenshot,
                       f.created_at,
                       e.event_name,
                       e.event_date,
                       e.status,
                       REPLACE(e.link, 'www', 'm') AS link
                FROM event_crawl_failed f
                LEFT JOIN events e ON e.event_id = f.event_id
                """ + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset";

        var content = jdbcClient.sql(dataSql)
                .param("limit", size)
                .param("offset", page * size)
                .query(this::mapRow)
                .list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new EventCrawlFailedPageResponse(content, page, size, total, totalPages);
    }

    private static String resolveOrderBy(String sortBy, String sortDir) {
        String by = sortBy == null || sortBy.isBlank() ? "created_at" : sortBy.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_BY.contains(by)) {
            by = "created_at";
        }
        String dir = sortDir == null || sortDir.isBlank() ? "desc" : sortDir.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_DIR.contains(dir)) {
            dir = "desc";
        }
        String upperDir = dir.toUpperCase(Locale.ROOT);
        if ("event_date".equals(by)) {
            return "(e.event_date IS NULL), e.event_date " + upperDir;
        }
        return "f.created_at " + upperDir;
    }

    private EventCrawlFailedRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var createdAt = rs.getTimestamp("created_at");
        var eventDate = rs.getTimestamp("event_date");
        return new EventCrawlFailedRowResponse(
                rs.getLong("event_id"),
                rs.getString("type"),
                rs.getString("message"),
                rs.getString("screenshot"),
                createdAt != null ? createdAt.toLocalDateTime() : null,
                rs.getString("event_name"),
                eventDate != null ? eventDate.toLocalDateTime() : null,
                rs.getString("status"),
                rs.getString("link")
        );
    }
}
