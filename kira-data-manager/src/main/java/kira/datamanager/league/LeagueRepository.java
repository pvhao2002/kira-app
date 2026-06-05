package kira.datamanager.league;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class LeagueRepository {

    private final JdbcClient jdbcClient;

    public LeagueRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public LeaguePageResponse findPage(int page, int size, String q, Boolean isMain, String country) {
        var where = buildWhereClause(q, isMain, country);

        var countSql = "SELECT COUNT(*) FROM leagues WHERE 1=1" + where.clause();
        var countSpec = bindParams(jdbcClient.sql(countSql), where);
        var total = countSpec.query((rs, rowNum) -> rs.getLong(1)).single();

        var dataSql = """
                SELECT league_id, league_name, logo_url, country, is_main, total_events, created_at, updated_at
                FROM leagues
                WHERE 1=1
                """ + where.clause()
                + " ORDER BY is_main DESC, COALESCE(country, '') ASC, league_name ASC LIMIT :limit OFFSET :offset";

        var dataSpec = bindParams(jdbcClient.sql(dataSql), where)
                .param("limit", size)
                .param("offset", page * size);

        var content = dataSpec.query(this::mapRow).list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new LeaguePageResponse(content, page, size, total, totalPages);
    }

    public List<String> suggestLeagueNames(String q, int limit) {
        var pattern = "%" + q.trim() + "%";
        return jdbcClient.sql("""
                        SELECT DISTINCT league_name FROM leagues
                        WHERE league_name LIKE :q
                        ORDER BY league_name
                        LIMIT :limit
                        """)
                .param("q", pattern)
                .param("limit", limit)
                .query((rs, rowNum) -> rs.getString(1))
                .list();
    }

    public List<String> suggestCountries(String q, int limit) {
        var pattern = "%" + q.trim() + "%";
        return jdbcClient.sql("""
                        SELECT DISTINCT country FROM leagues
                        WHERE country IS NOT NULL AND country <> '' AND country LIKE :q
                        ORDER BY country
                        LIMIT :limit
                        """)
                .param("q", pattern)
                .param("limit", limit)
                .query((rs, rowNum) -> rs.getString(1))
                .list();
    }

    /** @return số dòng đã cập nhật (0 nếu không có league_id) */
    public int updateMain(int leagueId, boolean isMain) {
        return jdbcClient.sql("""
                        UPDATE leagues SET is_main = :isMain, updated_at = NOW()
                        WHERE league_id = :leagueId
                        """)
                .param("isMain", isMain)
                .param("leagueId", leagueId)
                .update();
    }

    private WhereClause buildWhereClause(String q, Boolean isMain, String country) {
        var clause = new StringBuilder();
        String qNorm = null;
        Boolean main = null;
        String countryNorm = null;

        if (q != null && !q.isBlank()) {
            qNorm = q.trim();
            clause.append(" AND (league_name LIKE :q OR country LIKE :q)");
        }
        if (isMain != null) {
            main = isMain;
            clause.append(" AND is_main = :isMain");
        }
        if (country != null && !country.isBlank()) {
            countryNorm = country.trim();
            clause.append(" AND country LIKE :country");
        }

        return new WhereClause(clause.toString(), qNorm, main, countryNorm);
    }

    private JdbcClient.StatementSpec bindParams(JdbcClient.StatementSpec spec, WhereClause w) {
        if (w.q() != null) {
            spec = spec.param("q", "%" + w.q() + "%");
        }
        if (w.isMain() != null) {
            spec = spec.param("isMain", w.isMain());
        }
        if (w.country() != null) {
            spec = spec.param("country", "%" + w.country() + "%");
        }
        return spec;
    }

    private LeagueRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var logoUrl = rs.getString("logo_url");
        var c = rs.getString("country");
        var mainObj = rs.getObject("is_main");
        boolean main = mainObj instanceof Boolean b ? b : (mainObj instanceof Number n && n.intValue() != 0);
        var total = rs.getObject("total_events", Integer.class);
        var created = rs.getTimestamp("created_at");
        var updated = rs.getTimestamp("updated_at");
        return new LeagueRowResponse(
                rs.getInt("league_id"),
                rs.getString("league_name"),
                logoUrl,
                c,
                main,
                total != null ? total : 0,
                created != null ? created.toLocalDateTime() : null,
                updated != null ? updated.toLocalDateTime() : null
        );
    }

    private record WhereClause(
            String clause,
            String q,
            Boolean isMain,
            String country
    ) {
    }
}
