package kira.datamanager.team;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class TeamRepository {

    private final JdbcClient readJdbcClient;

    public TeamRepository(@Qualifier("readJdbcClient") JdbcClient readJdbcClient) {
        this.readJdbcClient = readJdbcClient;
    }

    public TeamPageResponse findPage(int page, int size, String q) {
        var where = "";
        String qNorm = null;
        if (q != null && !q.isBlank()) {
            qNorm = q.trim();
            where = " AND team_name LIKE :q";
        }

        var countSql = "SELECT COUNT(*) FROM teams WHERE 1=1" + where;
        var countSpec = readJdbcClient.sql(countSql);
        if (qNorm != null) {
            countSpec = countSpec.param("q", "%" + qNorm + "%");
        }
        var total = countSpec.query((rs, rowNum) -> rs.getLong(1)).single();

        var dataSql = """
                SELECT team_id, team_name, logo_url, created_at, updated_at
                FROM teams
                WHERE 1=1
                """ + where
                + " ORDER BY team_name ASC LIMIT :limit OFFSET :offset";

        var dataSpec = readJdbcClient.sql(dataSql)
                .param("limit", size)
                .param("offset", page * size);
        if (qNorm != null) {
            dataSpec = dataSpec.param("q", "%" + qNorm + "%");
        }

        var content = dataSpec.query(this::mapRow).list();

        var totalPages = size > 0 ? (int) Math.ceil((double) total / (double) size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new TeamPageResponse(content, page, size, total, totalPages);
    }

    public List<String> suggestTeamNames(String q, int limit) {
        var pattern = "%" + q.trim() + "%";
        return readJdbcClient.sql("""
                        SELECT DISTINCT team_name FROM teams
                        WHERE team_name LIKE :q
                        ORDER BY team_name
                        LIMIT :limit
                        """)
                .param("q", pattern)
                .param("limit", limit)
                .query((rs, rowNum) -> rs.getString(1))
                .list();
    }

    private TeamRowResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        var logoUrl = rs.getString("logo_url");
        var created = rs.getTimestamp("created_at");
        var updated = rs.getTimestamp("updated_at");
        return new TeamRowResponse(
                rs.getInt("team_id"),
                rs.getString("team_name"),
                logoUrl,
                created != null ? created.toLocalDateTime() : null,
                updated != null ? updated.toLocalDateTime() : null
        );
    }
}
