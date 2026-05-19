package kira.producer.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class SoccerTeamRecentStatService {

    private static final ZoneId JOB_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private static final String DELETE_CURRENT_WINDOW_SQL = """
            DELETE FROM soccer_team_recent_stat
            WHERE window_end = :windowEndDate
            """;

    private static final String INSERT_RECENT_STATS_SQL = """
            INSERT INTO soccer_team_recent_stat (
                metric_type,
                team_id,
                team_name,
                window_start,
                window_end,
                eligible_match_count,
                matched_match_count,
                percentage,
                rank_no,
                computed_at
            )
            WITH qualified_odds AS (
                SELECT event_id
                FROM event_odds
                WHERE type IN ('open', 'pre-match')
                  AND market IN ('hdc', 'ou', 'corner')
                GROUP BY event_id
                HAVING COUNT(DISTINCT CONCAT(type, ':', market)) = 6
            ),
            team_matches AS (
                SELECT e.event_id,
                       e.home_id AS team_id,
                       t.team_name,
                       er.ft_total_goal,
                       er.ft_total_corner,
                       er.ht_total_goal
                FROM events e
                JOIN event_result er ON er.event_id = e.event_id
                JOIN teams t ON t.team_id = e.home_id
                JOIN qualified_odds ON qualified_odds.event_id = e.event_id
                WHERE e.event_date >= :windowStart
                  AND e.event_date < :windowEnd
                  AND e.home_id IS NOT NULL
                UNION ALL
                SELECT e.event_id,
                       e.away_id AS team_id,
                       t.team_name,
                       er.ft_total_goal,
                       er.ft_total_corner,
                       er.ht_total_goal
                FROM events e
                JOIN event_result er ON er.event_id = e.event_id
                JOIN teams t ON t.team_id = e.away_id
                JOIN qualified_odds ON qualified_odds.event_id = e.event_id
                WHERE e.event_date >= :windowStart
                  AND e.event_date < :windowEnd
                  AND e.away_id IS NOT NULL
            )
            SELECT ranked.metric_type,
                   ranked.team_id,
                   ranked.team_name,
                   :windowStartDate,
                   :windowEndDate,
                   ranked.eligible_match_count,
                   ranked.matched_match_count,
                   ranked.percentage,
                   ranked.rank_no,
                   :computedAt
            FROM (
                SELECT metric_rows.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY metric_rows.metric_type
                           ORDER BY metric_rows.percentage DESC,
                                    metric_rows.eligible_match_count DESC,
                                    metric_rows.team_name ASC
                       ) AS rank_no
                FROM (
                    SELECT 'TOTAL_GOALS_3_PLUS' AS metric_type,
                           team_id,
                           team_name,
                           COUNT(*) AS eligible_match_count,
                           SUM(CASE WHEN ft_total_goal >= 3 THEN 1 ELSE 0 END) AS matched_match_count,
                           ROUND(SUM(CASE WHEN ft_total_goal >= 3 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS percentage
                    FROM team_matches
                    GROUP BY team_id, team_name
                    HAVING COUNT(*) >= 5

                    UNION ALL

                    SELECT 'TOTAL_CORNERS_10_PLUS' AS metric_type,
                           team_id,
                           team_name,
                           COUNT(*) AS eligible_match_count,
                           SUM(CASE WHEN ft_total_corner >= 10 THEN 1 ELSE 0 END) AS matched_match_count,
                           ROUND(SUM(CASE WHEN ft_total_corner >= 10 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS percentage
                    FROM team_matches
                    GROUP BY team_id, team_name
                    HAVING COUNT(*) >= 5

                    UNION ALL

                    SELECT 'FIRST_HALF_GOAL' AS metric_type,
                           team_id,
                           team_name,
                           COUNT(*) AS eligible_match_count,
                           SUM(CASE WHEN ht_total_goal >= 1 THEN 1 ELSE 0 END) AS matched_match_count,
                           ROUND(SUM(CASE WHEN ht_total_goal >= 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS percentage
                    FROM team_matches
                    GROUP BY team_id, team_name
                    HAVING COUNT(*) >= 5
                ) metric_rows
            ) ranked
            WHERE ranked.rank_no <= 10
            """;

    @Transactional
    public int recomputeRecentStats() {
        var now = LocalDateTime.now(JOB_ZONE);
        var windowStart = now.minusMonths(3);
        var params = new MapSqlParameterSource()
                .addValue("windowStart", windowStart)
                .addValue("windowEnd", now)
                .addValue("windowStartDate", windowStart.toLocalDate())
                .addValue("windowEndDate", now.toLocalDate())
                .addValue("computedAt", now);

        jdbcTemplate.update(DELETE_CURRENT_WINDOW_SQL, params);
        return jdbcTemplate.update(INSERT_RECENT_STATS_SQL, params);
    }
}
