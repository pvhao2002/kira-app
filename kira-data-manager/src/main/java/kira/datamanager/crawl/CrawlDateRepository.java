package kira.datamanager.crawl;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Set;

@Repository
public class CrawlDateRepository {

    private static final Set<String> ALLOWED_STATUS = Set.of(
            "pending", "picked", "in_progress", "done", "failed"
    );

    private static final Set<String> ALLOWED_SORT_BY = Set.of("date", "total_events");
    private static final Set<String> ALLOWED_SORT_DIR = Set.of("asc", "desc");

    private final JdbcClient jdbcClient;

    public CrawlDateRepository(@Qualifier("readJdbcClient") JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
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

    public CrawlDatePageResponse findPage(int page, int size, String status, String date, String dateFrom, String dateTo,
                                          String sortBy, String sortDir) {
        var where = buildWhereClause(status, date, dateFrom, dateTo);
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

    private WhereClause buildWhereClause(String status, String date, String dateFrom, String dateTo) {
        var clause = new StringBuilder();
        String normalizedStatus = null;
        String normalizedDate = null;
        String from = null;
        String to = null;

        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toLowerCase();
            clause.append(" AND status = :status");
        }
        if (date != null && !date.isBlank()) {
            normalizedDate = date.trim();
            clause.append(" AND date = :date");
        }
        if (dateFrom != null && !dateFrom.isBlank()) {
            from = dateFrom.trim();
            clause.append(" AND date >= :dateFrom");
        }
        if (dateTo != null && !dateTo.isBlank()) {
            to = dateTo.trim();
            clause.append(" AND date <= :dateTo");
        }

        return new WhereClause(clause.toString(), normalizedStatus, normalizedDate, from, to);
    }

    private JdbcClient.StatementSpec bindParams(JdbcClient.StatementSpec spec, WhereClause w) {
        if (w.status() != null) {
            spec = spec.param("status", w.status());
        }
        if (w.date() != null) {
            spec = spec.param("date", w.date());
        }
        if (w.dateFrom() != null) {
            spec = spec.param("dateFrom", w.dateFrom());
        }
        if (w.dateTo() != null) {
            spec = spec.param("dateTo", w.dateTo());
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
            String date,
            String dateFrom,
            String dateTo
    ) {
    }
}
