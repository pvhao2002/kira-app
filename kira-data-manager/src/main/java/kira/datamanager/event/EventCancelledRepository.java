package kira.datamanager.event;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Set;

@Repository
public class EventCancelledRepository {

    private static final Set<String> ALLOWED_SORT_BY = Set.of("event_date", "created_at");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");

    private final JdbcClient jdbcClient;

    public EventCancelledRepository(@Qualifier("readJdbcClient") JdbcClient jdbcClient) {
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

    public EventCancelledPageResponse findPage(int page, int size, String sortBy, String sortDir) {
        var orderBy = resolveOrderBy(sortBy, sortDir);

        var countSql = "SELECT COUNT(*) FROM event_cancelled";
        var total = jdbcClient.sql(countSql).query((rs, rowNum) -> rs.getLong(1)).single();

        var dataSql = """
                SELECT ec.event_id,
                       COALESCE(e.event_name, ec.event_name) AS event_name,
                       COALESCE(e.event_date, ec.event_date) AS event_date,
                       COALESCE(e.status, ec.status) AS status,
                       COALESCE(e.link, ec.link) AS link,
                       ec.created_at
                FROM event_cancelled ec
                LEFT JOIN events e ON e.event_id = ec.event_id
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

        return new EventCancelledPageResponse(content, page, size, total, totalPages);
    }

    private static String resolveOrderBy(String sortBy, String sortDir) {
        String by = sortBy == null || sortBy.isBlank() ? "event_date" : sortBy.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_BY.contains(by)) {
            by = "event_date";
        }
        String dir = sortDir == null || sortDir.isBlank() ? "desc" : sortDir.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_DIR.contains(dir)) {
            dir = "desc";
        }
        String upperDir = dir.toUpperCase(Locale.ROOT);
        if ("created_at".equals(by)) {
            return "ec.created_at " + upperDir;
        }
        return "(COALESCE(e.event_date, ec.event_date) IS NULL), COALESCE(e.event_date, ec.event_date) " + upperDir;
    }

    private EventCancelledRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var ed = rs.getTimestamp("event_date");
        var ca = rs.getTimestamp("created_at");
        return new EventCancelledRowResponse(
                rs.getLong("event_id"),
                rs.getString("event_name"),
                ed != null ? ed.toLocalDateTime() : null,
                rs.getString("status"),
                rs.getString("link"),
                ca != null ? ca.toLocalDateTime() : null
        );
    }
}
