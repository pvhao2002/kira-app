package kira.datamanager.event;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Set;

@Repository
public class EventClaimRepository {

    private static final Set<String> ALLOWED_SORT_BY = Set.of("claimed_at", "event_date");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");

    private final JdbcClient readJdbcClient;

    public EventClaimRepository(@Qualifier("readJdbcClient") JdbcClient readJdbcClient) {
        this.readJdbcClient = readJdbcClient;
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

    public EventClaimPageResponse findPage(int page, int size, String sortBy, String sortDir, String status) {
        var orderBy = resolveOrderBy(sortBy, sortDir);

        String countSql;
        long total;
        if (status != null && !status.isBlank()) {
            countSql = "SELECT COUNT(*) FROM event_claim WHERE status = :status";
            total = readJdbcClient.sql(countSql)
                    .param("status", status)
                    .query((rs, rowNum) -> rs.getLong(1))
                    .single();
        } else {
            countSql = "SELECT COUNT(*) FROM event_claim";
            total = readJdbcClient.sql(countSql)
                    .query((rs, rowNum) -> rs.getLong(1))
                    .single();
        }

        String dataSql = """
                SELECT c.claim_id,
                       c.event_id,
                       c.claimed_by,
                       c.claimed_at,
                       c.status AS claim_status,
                       e.event_name,
                       e.event_date,
                       e.status AS event_status,
                       REPLACE(e.link, 'www', 'm') AS link
                FROM event_claim c
                LEFT JOIN events e ON e.event_id = c.event_id
                """;

        if (status != null && !status.isBlank()) {
            dataSql += " WHERE c.status = :status";
        }

        dataSql += " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset";

        var client = readJdbcClient.sql(dataSql)
                .param("limit", size)
                .param("offset", page * size);
        if (status != null && !status.isBlank()) {
            client = client.param("status", status);
        }

        var content = client.query(this::mapRow).list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new EventClaimPageResponse(content, page, size, total, totalPages);
    }

    private static String resolveOrderBy(String sortBy, String sortDir) {
        String by = sortBy == null || sortBy.isBlank() ? "claimed_at" : sortBy.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_BY.contains(by)) {
            by = "claimed_at";
        }
        String dir = sortDir == null || sortDir.isBlank() ? "desc" : sortDir.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_DIR.contains(dir)) {
            dir = "desc";
        }
        String upperDir = dir.toUpperCase(Locale.ROOT);
        if ("event_date".equals(by)) {
            return "(e.event_date IS NULL), e.event_date " + upperDir;
        }
        return "c.claimed_at " + upperDir;
    }

    private EventClaimRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var claimedAt = rs.getTimestamp("claimed_at");
        var eventDate = rs.getTimestamp("event_date");
        return new EventClaimRowResponse(
                rs.getLong("claim_id"),
                rs.getLong("event_id"),
                rs.getString("claimed_by"),
                claimedAt != null ? claimedAt.toLocalDateTime() : null,
                rs.getString("claim_status"),
                rs.getString("event_name"),
                eventDate != null ? eventDate.toLocalDateTime() : null,
                rs.getString("event_status"),
                rs.getString("link")
        );
    }
}
