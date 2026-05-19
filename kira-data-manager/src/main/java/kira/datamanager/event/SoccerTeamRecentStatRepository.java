package kira.datamanager.event;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class SoccerTeamRecentStatRepository {

    private static final List<String> METRIC_ORDER = List.of(
            "TOTAL_GOALS_3_PLUS",
            "TOTAL_CORNERS_10_PLUS",
            "FIRST_HALF_GOAL"
    );

    private final JdbcClient readJdbcClient;

    public SoccerTeamRecentStatRepository(@Qualifier("readJdbcClient") JdbcClient readJdbcClient) {
        this.readJdbcClient = readJdbcClient;
    }

    public SoccerTeamRecentStatResponse findLatest() {
        var rows = readJdbcClient.sql("""
                        SELECT metric_type,
                               rank_no,
                               team_id,
                               team_name,
                               eligible_match_count,
                               matched_match_count,
                               percentage,
                               window_start,
                               window_end,
                               computed_at
                        FROM soccer_team_recent_stat
                        WHERE window_end = (
                            SELECT MAX(window_end)
                            FROM soccer_team_recent_stat
                        )
                        ORDER BY FIELD(metric_type, 'TOTAL_GOALS_3_PLUS', 'TOTAL_CORNERS_10_PLUS', 'FIRST_HALF_GOAL'),
                                 rank_no ASC
                        """)
                .query(this::mapRow)
                .list();

        Map<String, List<SoccerTeamRecentStatRowResponse>> groupedRows = new LinkedHashMap<>();
        for (var metricType : METRIC_ORDER) {
            groupedRows.put(metricType, rows.stream()
                    .filter(row -> metricType.equals(row.metricType()))
                    .map(SoccerTeamRecentStatRecord::row)
                    .toList());
        }

        var groups = groupedRows.entrySet().stream()
                .map(entry -> new SoccerTeamRecentStatGroupResponse(entry.getKey(), entry.getValue()))
                .toList();
        return new SoccerTeamRecentStatResponse(groups);
    }

    private SoccerTeamRecentStatRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        var windowStart = rs.getDate("window_start");
        var windowEnd = rs.getDate("window_end");
        var computedAt = rs.getTimestamp("computed_at");
        var row = new SoccerTeamRecentStatRowResponse(
                rs.getInt("rank_no"),
                rs.getInt("team_id"),
                rs.getString("team_name"),
                rs.getInt("eligible_match_count"),
                rs.getInt("matched_match_count"),
                rs.getBigDecimal("percentage"),
                windowStart != null ? windowStart.toLocalDate() : null,
                windowEnd != null ? windowEnd.toLocalDate() : null,
                computedAt != null ? computedAt.toLocalDateTime() : null
        );
        return new SoccerTeamRecentStatRecord(rs.getString("metric_type"), row);
    }

    private record SoccerTeamRecentStatRecord(String metricType, SoccerTeamRecentStatRowResponse row) {
    }
}
