package kira.datamanager.crawl;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Repository
public class CrawlDateRepository {

    private static final Set<String> ALLOWED_STATUS = Set.of(
            "pending", "picked", "in_progress", "done", "failed"
    );

    private static final Set<String> ALLOWED_SORT_BY = Set.of("date", "total_events");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");
    private static final Set<String> ALLOWED_TOTAL_EVENT_FILTER = Set.of("all", "0");

    private final JdbcClient jdbcClient;

    private static final String SQL_MARK_PICKED = """
            INSERT INTO crawl_date (date, status, total_events) VALUES (:date, 'picked', 0)
            ON DUPLICATE KEY UPDATE status = 'picked'
            """;

    public CrawlDateRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void markPicked(String date) {
        jdbcClient.sql(SQL_MARK_PICKED)
                .param("date", date)
                .update();
    }

    public void markPickedBatch(List<String> dates) {
        for (String date : dates) {
            markPicked(date);
        }
    }

    public static boolean isAllowedStatus(String status) {
        if (status == null || status.isBlank()) {
            return true;
        }
        return ALLOWED_STATUS.contains(status.trim().toLowerCase());
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

    public static boolean isAllowedTotalEventFilter(String totalEvent) {
        if (totalEvent == null || totalEvent.isBlank()) {
            return true;
        }
        return ALLOWED_TOTAL_EVENT_FILTER.contains(totalEvent.trim().toLowerCase(Locale.ROOT));
    }

    public CrawlDatePageResponse findPage(int page, int size, String status, String date, String dateFrom, String dateTo,
                                          String totalEvent, String sortBy, String sortDir) {
        var where = buildWhereClause(status, date, dateFrom, dateTo, totalEvent);
        var orderBy = resolveOrderBy(sortBy, sortDir);

        var countSql = "SELECT COUNT(*) FROM crawl_date WHERE 1=1" + where.clause();
        var countSpec = bindParams(jdbcClient.sql(countSql), where);
        var total = countSpec.query((rs, rowNum) -> rs.getLong(1)).single();

        var dataSql = """
                SELECT date, status, message, total_events, created_at, updated_at
                FROM crawl_date
                WHERE 1=1
                """ + where.clause() + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset";

        var dataSpec = bindParams(jdbcClient.sql(dataSql), where)
                .param("limit", size)
                .param("offset", page * size);

        var content = dataSpec.query(this::mapRow).list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new CrawlDatePageResponse(content, page, size, total, totalPages);
    }

    /**
     * Whitelist-only ORDER BY fragment (no user-controlled column names).
     */
    private static String resolveOrderBy(String sortBy, String sortDir) {
        String by = sortBy == null || sortBy.isBlank() ? "date" : sortBy.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_BY.contains(by)) {
            by = "date";
        }
        String col = "date".equals(by) ? "date" : "total_events";
        String dir = sortDir == null || sortDir.isBlank() ? "desc" : sortDir.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SORT_DIR.contains(dir)) {
            dir = "desc";
        }
        return col + " " + dir.toUpperCase(Locale.ROOT);
    }

    private WhereClause buildWhereClause(String status, String date, String dateFrom, String dateTo, String totalEvent) {
        var clause = new StringBuilder();
        String normalizedStatus = null;
        String compactDate = null;
        String isoDate = null;
        String fromCompact = null;
        String fromIso = null;
        String toCompact = null;
        String toIso = null;
        Integer totalEvents = null;

        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toLowerCase();
            clause.append(" AND status = :status");
        }
        if (date != null && !date.isBlank()) {
            compactDate = toCompactDateValue(date);
            isoDate = toIsoDateValue(date);
            clause.append(" AND date IN (:dateCompact, :dateIso)");
        }
        if (dateFrom != null && !dateFrom.isBlank()) {
            fromCompact = toCompactDateValue(dateFrom);
            fromIso = toIsoDateValue(dateFrom);
        }
        if (dateTo != null && !dateTo.isBlank()) {
            toCompact = toCompactDateValue(dateTo);
            toIso = toIsoDateValue(dateTo);
        }
        if (fromCompact != null || toCompact != null) {
            if (fromCompact != null && toCompact != null) {
                clause.append("""
                         AND (
                            (date NOT LIKE '%-%' AND date BETWEEN :dateFromCompact AND :dateToCompact)
                            OR (date LIKE '____-__-__' AND date BETWEEN :dateFromIso AND :dateToIso)
                         )
                        """);
            } else if (fromCompact != null) {
                clause.append("""
                         AND (
                            (date NOT LIKE '%-%' AND date >= :dateFromCompact)
                            OR (date LIKE '____-__-__' AND date >= :dateFromIso)
                         )
                        """);
            } else {
                clause.append("""
                         AND (
                            (date NOT LIKE '%-%' AND date <= :dateToCompact)
                            OR (date LIKE '____-__-__' AND date <= :dateToIso)
                         )
                        """);
            }
        }
        if (totalEvent != null && !totalEvent.isBlank() && !"all".equalsIgnoreCase(totalEvent.trim())) {
            totalEvents = Integer.parseInt(totalEvent.trim());
            clause.append(" AND total_events = :totalEvents");
        }

        return new WhereClause(clause.toString(), normalizedStatus, compactDate, isoDate, fromCompact, fromIso,
                toCompact, toIso, totalEvents);
    }

    private static String toCompactDateValue(String value) {
        return value.trim().replace("-", "");
    }

    private static String toIsoDateValue(String value) {
        var compact = toCompactDateValue(value);
        if (compact.length() == 8) {
            return compact.substring(0, 4) + "-" + compact.substring(4, 6) + "-" + compact.substring(6, 8);
        }
        return value.trim();
    }

    private JdbcClient.StatementSpec bindParams(JdbcClient.StatementSpec spec, WhereClause w) {
        if (w.status() != null) {
            spec = spec.param("status", w.status());
        }
        if (w.dateCompact() != null) {
            spec = spec.param("dateCompact", w.dateCompact())
                    .param("dateIso", w.dateIso());
        }
        if (w.dateFromCompact() != null) {
            spec = spec.param("dateFromCompact", w.dateFromCompact())
                    .param("dateFromIso", w.dateFromIso());
        }
        if (w.dateToCompact() != null) {
            spec = spec.param("dateToCompact", w.dateToCompact())
                    .param("dateToIso", w.dateToIso());
        }
        if (w.totalEvents() != null) {
            spec = spec.param("totalEvents", w.totalEvents());
        }
        return spec;
    }

    private CrawlDateRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var message = rs.getString("message");
        var total = rs.getObject("total_events", Integer.class);
        var created = rs.getTimestamp("created_at");
        var updated = rs.getTimestamp("updated_at");
        return new CrawlDateRowResponse(
                rs.getString("date"),
                rs.getString("status"),
                message,
                total != null ? total : 0,
                created != null ? created.toLocalDateTime() : null,
                updated != null ? updated.toLocalDateTime() : null
        );
    }

    private record WhereClause(
            String clause,
            String status,
            String dateCompact,
            String dateIso,
            String dateFromCompact,
            String dateFromIso,
            String dateToCompact,
            String dateToIso,
            Integer totalEvents
    ) {
    }
}
