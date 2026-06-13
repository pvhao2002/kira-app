package com.queue.kiraqueue.prediction;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class HistoricalScoreMatcher {

    private static final String TERMINAL_STATUS_FILTER = """
              and (
                    exists (select 1
                            from aiscore_match_status_ref r
                            where r.status_type = 'status_id'
                              and r.code = e.status_id
                              and r.sport_id = 1
                              and r.is_terminal = 1
                              and r.code not in (9, 12))
                    or (e.status_id is null and e.status = 'FT')
                )
            """;

    private static final String HDC_OU_JOINS_NO_PRICE = """
                     inner join event_odds hist_open_hdc
                                on hist_open_hdc.event_id = e.event_id
                                    and hist_open_hdc.type = 'open'
                                    and hist_open_hdc.market = 'hdc'
                                    and hist_open_hdc.line = :open_hdc_line
                     inner join event_odds hist_pm_hdc
                                on hist_pm_hdc.event_id = e.event_id
                                    and hist_pm_hdc.type = 'pre-match'
                                    and hist_pm_hdc.market = 'hdc'
                                    and hist_pm_hdc.line = :prematch_hdc_line
                     inner join event_odds hist_open_ou
                                on hist_open_ou.event_id = e.event_id
                                    and hist_open_ou.type = 'open'
                                    and hist_open_ou.market = 'ou'
                                    and hist_open_ou.line = :open_ou_line
                     inner join event_odds hist_pm_ou
                                on hist_pm_ou.event_id = e.event_id
                                    and hist_pm_ou.type = 'pre-match'
                                    and hist_pm_ou.market = 'ou'
                                    and hist_pm_ou.line = :prematch_ou_line
            """;

    private static final String CORNER_JOINS_NO_PRICE = """
                     inner join event_odds hist_open_corner
                                on hist_open_corner.event_id = e.event_id
                                    and hist_open_corner.type = 'open'
                                    and hist_open_corner.market = 'corner'
                                    and hist_open_corner.line = :open_corner_line
                     inner join event_odds hist_pm_corner
                                on hist_pm_corner.event_id = e.event_id
                                    and hist_pm_corner.type = 'pre-match'
                                    and hist_pm_corner.market = 'corner'
                                    and hist_pm_corner.line = :prematch_corner_line
            """;

    private static final String HDC_OU_JOINS_WITH_PRICE = """
                     inner join event_odds hist_open_hdc
                                on hist_open_hdc.event_id = e.event_id
                                    and hist_open_hdc.type = 'open'
                                    and hist_open_hdc.market = 'hdc'
                                    and hist_open_hdc.line = :open_hdc_line
                                    and hist_open_hdc.price_a = :open_hdc_price_a
                                    and hist_open_hdc.price_b = :open_hdc_price_b
                     inner join event_odds hist_pm_hdc
                                on hist_pm_hdc.event_id = e.event_id
                                    and hist_pm_hdc.type = 'pre-match'
                                    and hist_pm_hdc.market = 'hdc'
                                    and hist_pm_hdc.line = :prematch_hdc_line
                                    and hist_pm_hdc.price_a = :prematch_hdc_price_a
                                    and hist_pm_hdc.price_b = :prematch_hdc_price_b
                     inner join event_odds hist_open_ou
                                on hist_open_ou.event_id = e.event_id
                                    and hist_open_ou.type = 'open'
                                    and hist_open_ou.market = 'ou'
                                    and hist_open_ou.line = :open_ou_line
                                    and hist_open_ou.price_a = :open_ou_price_a
                                    and hist_open_ou.price_b = :open_ou_price_b
                     inner join event_odds hist_pm_ou
                                on hist_pm_ou.event_id = e.event_id
                                    and hist_pm_ou.type = 'pre-match'
                                    and hist_pm_ou.market = 'ou'
                                    and hist_pm_ou.line = :prematch_ou_line
                                    and hist_pm_ou.price_a = :prematch_ou_price_a
                                    and hist_pm_ou.price_b = :prematch_ou_price_b
            """;

    private static final String CORNER_JOINS_WITH_PRICE = """
                     inner join event_odds hist_open_corner
                                on hist_open_corner.event_id = e.event_id
                                    and hist_open_corner.type = 'open'
                                    and hist_open_corner.market = 'corner'
                                    and hist_open_corner.line = :open_corner_line
                                    and hist_open_corner.price_a = :open_corner_price_a
                                    and hist_open_corner.price_b = :open_corner_price_b
                     inner join event_odds hist_pm_corner
                                on hist_pm_corner.event_id = e.event_id
                                    and hist_pm_corner.type = 'pre-match'
                                    and hist_pm_corner.market = 'corner'
                                    and hist_pm_corner.line = :prematch_corner_line
                                    and hist_pm_corner.price_a = :prematch_corner_price_a
                                    and hist_pm_corner.price_b = :prematch_corner_price_b
            """;

    private static final String SQL_SUFFIX = """
            group by er.ft_goal_str
            order by match_count desc, er.ft_goal_str asc
            limit 3
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<ScoreMatchRow> findTopScoresNoPrice(long eventId, TargetEventOdds odds) {
        return queryScores(buildNoPriceSql(odds, null), baseLineParams(eventId, odds));
    }

    public List<ScoreMatchRow> findTopScoresWithPrice(long eventId, TargetEventOdds odds) {
        var params = baseLineParams(eventId, odds)
                .addValue("open_hdc_price_a", odds.openHdcPriceA())
                .addValue("open_hdc_price_b", odds.openHdcPriceB())
                .addValue("prematch_hdc_price_a", odds.prematchHdcPriceA())
                .addValue("prematch_hdc_price_b", odds.prematchHdcPriceB())
                .addValue("open_ou_price_a", odds.openOuPriceA())
                .addValue("open_ou_price_b", odds.openOuPriceB())
                .addValue("prematch_ou_price_a", odds.prematchOuPriceA())
                .addValue("prematch_ou_price_b", odds.prematchOuPriceB())
                .addValue("open_corner_price_a", odds.openCornerPriceA())
                .addValue("open_corner_price_b", odds.openCornerPriceB())
                .addValue("prematch_corner_price_a", odds.prematchCornerPriceA())
                .addValue("prematch_corner_price_b", odds.prematchCornerPriceB());
        return queryScores(buildWithPriceSql(odds, null), params);
    }

    public List<ScoreMatchRow> findTopScoresWithLeagueNoPrice(long eventId, TargetEventOdds odds) {
        return queryScores(
                buildNoPriceSql(odds, "and e.league_id = :league_id"),
                baseLineParams(eventId, odds).addValue("league_id", odds.leagueId())
        );
    }

    static String buildNoPriceSql(TargetEventOdds odds, String extraWhere) {
        var cornerJoins = PredictionEngineSupport.hasCornerLines(odds) ? CORNER_JOINS_NO_PRICE : "";
        var whereClause = extraWhere == null ? "" : "\n              " + extraWhere;
        return """
            select er.ft_goal_str,
                   count(*) as match_count
            from events e
                     inner join event_result er on er.event_id = e.event_id
            """ + HDC_OU_JOINS_NO_PRICE + cornerJoins + """
            where e.event_id <> :event_id
              and er.ft_goal_str is not null
              and er.ft_goal_str <> ''
            """ + whereClause + TERMINAL_STATUS_FILTER + SQL_SUFFIX;
    }

    static String buildWithPriceSql(TargetEventOdds odds, String extraWhere) {
        var cornerJoins = PredictionEngineSupport.hasCornerLines(odds) ? CORNER_JOINS_WITH_PRICE : "";
        var whereClause = extraWhere == null ? "" : "\n              " + extraWhere;
        return """
            select er.ft_goal_str,
                   count(*) as match_count
            from events e
                     inner join event_result er on er.event_id = e.event_id
            """ + HDC_OU_JOINS_WITH_PRICE + cornerJoins + """
            where e.event_id <> :event_id
              and er.ft_goal_str is not null
              and er.ft_goal_str <> ''
            """ + whereClause + TERMINAL_STATUS_FILTER + SQL_SUFFIX;
    }

    private MapSqlParameterSource baseLineParams(long eventId, TargetEventOdds odds) {
        return new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("open_hdc_line", odds.openHdcLine())
                .addValue("prematch_hdc_line", odds.prematchHdcLine())
                .addValue("open_ou_line", odds.openOuLine())
                .addValue("prematch_ou_line", odds.prematchOuLine())
                .addValue("open_corner_line", odds.openCornerLine())
                .addValue("prematch_corner_line", odds.prematchCornerLine());
    }

    private List<ScoreMatchRow> queryScores(String sql, MapSqlParameterSource params) {
        return jdbcTemplate.query(
                sql,
                params,
                (rs, rowNum) -> new ScoreMatchRow(rs.getString("ft_goal_str"), rs.getInt("match_count"))
        );
    }
}
