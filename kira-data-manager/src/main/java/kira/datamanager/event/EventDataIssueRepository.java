package kira.datamanager.event;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Repository
public class EventDataIssueRepository {

    private static final Set<String> ALLOWED_SORT_BY = Set.of("recorded_at", "event_date");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");
    private static final Set<String> ALLOWED_ISSUE_TYPE = Set.of("missing_stats", "missing_odds", "cancelled");

    private final JdbcClient readJdbcClient;

    public EventDataIssueRepository(@Qualifier("readJdbcClient") JdbcClient readJdbcClient) {
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

    public static boolean isAllowedIssueType(String issueType) {
        if (issueType == null || issueType.isBlank()) {
            return true;
        }
        return ALLOWED_ISSUE_TYPE.contains(issueType.trim().toLowerCase(Locale.ROOT));
    }

    public EventDataIssuePageResponse findPage(int page, int size, String sortBy, String sortDir, String issueType) {
        var orderBy = resolveOrderBy(sortBy, sortDir);
        var normalizedIssueType = normalizeIssueType(issueType);

        var countSql = """
                SELECT COUNT(*)
                FROM event_data_issue edi
                WHERE (:issueType IS NULL OR edi.issue_type = :issueType)
                """;
        var total = readJdbcClient.sql(countSql)
                .param("issueType", normalizedIssueType)
                .query((rs, rowNum) -> rs.getLong(1))
                .single();

        var dataSql = """
                SELECT edi.event_id,
                       edi.issue_type,
                       edi.description,
                       CASE
                           WHEN edi.screenshot IS NULL OR TRIM(edi.screenshot) = '' THEN FALSE
                           ELSE TRUE
                       END AS has_screenshot,
                       edi.recorded_at,
                       e.event_name,
                       e.event_date,
                       e.status,
                       e.link AS event_link
                FROM event_data_issue edi
                LEFT JOIN events e ON e.event_id = edi.event_id
                WHERE (:issueType IS NULL OR edi.issue_type = :issueType)
                """ + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset";

        var content = readJdbcClient.sql(dataSql)
                .param("issueType", normalizedIssueType)
                .param("limit", size)
                .param("offset", page * size)
                .query(this::mapRow)
                .list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new EventDataIssuePageResponse(content, page, size, total, totalPages);
    }

    public String findScreenshot(long eventId, String issueType, LocalDateTime recordedAt) {
        var sql = """
                SELECT edi.screenshot
                FROM event_data_issue edi
                WHERE edi.event_id = :eventId
                  AND edi.issue_type = :issueType
                  AND edi.recorded_at = :recordedAt
                LIMIT 1
                """;
        return readJdbcClient.sql(sql)
                .param("eventId", eventId)
                .param("issueType", issueType)
                .param("recordedAt", recordedAt)
                .query((rs, rowNum) -> rs.getString("screenshot"))
                .optional()
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .orElse(null);
    }

    private static String normalizeIssueType(String issueType) {
        if (issueType == null || issueType.isBlank()) {
            return null;
        }
        return issueType.trim().toLowerCase(Locale.ROOT);
    }

    private static String resolveOrderBy(String sortBy, String sortDir) {
        String by = sortBy == null || sortBy.isBlank() ? "recorded_at" : sortBy.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_BY.contains(by)) {
            by = "recorded_at";
        }
        String dir = sortDir == null || sortDir.isBlank() ? "desc" : sortDir.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_DIR.contains(dir)) {
            dir = "desc";
        }
        String upperDir = dir.toUpperCase(Locale.ROOT);
        if ("event_date".equals(by)) {
            return "(e.event_date IS NULL), e.event_date " + upperDir;
        }
        return "edi.recorded_at " + upperDir;
    }

    private EventDataIssueRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var recordedAt = rs.getTimestamp("recorded_at");
        var eventDate = rs.getTimestamp("event_date");
        return new EventDataIssueRowResponse(
                rs.getLong("event_id"),
                rs.getString("issue_type"),
                rs.getString("description"),
                rs.getBoolean("has_screenshot"),
                recordedAt != null ? recordedAt.toLocalDateTime() : null,
                rs.getString("event_name"),
                eventDate != null ? eventDate.toLocalDateTime() : null,
                rs.getString("status"),
                rs.getString("event_link")
        );
    }
}
