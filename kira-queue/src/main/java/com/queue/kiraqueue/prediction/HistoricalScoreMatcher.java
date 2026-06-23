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
        var whereClause = extraWhere == null ? "" : "\n              " + extraWhere;
        return buildScoreSql(buildOddsEventSubquery(odds, false), whereClause);
    }

    static String buildWithPriceSql(TargetEventOdds odds, String extraWhere) {
        var whereClause = extraWhere == null ? "" : "\n              " + extraWhere;
        return buildScoreSql(buildOddsEventSubquery(odds, true), whereClause);
    }

    private static String buildScoreSql(String oddsEventSubquery, String whereClause) {
        return """
                select er.ft_goal_str,
                       count(*) as match_count
                from event_result er
                         inner join (
                """ + indent(oddsEventSubquery, 12) + "\n" + """
                         ) eo on eo.event_id = er.event_id
                         inner join events e on e.event_id = er.event_id
                where e.event_id <> :event_id
                  and er.ft_goal_str is not null
                  and er.ft_goal_str <> ''
                """ + whereClause + TERMINAL_STATUS_FILTER + SQL_SUFFIX;
    }

    private static String buildOddsEventSubquery(TargetEventOdds odds, boolean includePrice) {
        var hasCorner = PredictionEngineSupport.hasCornerLines(odds);
        var requiredMatches = hasCorner ? 6 : 4;
        var cornerBranches = hasCorner ? """
                union all
                """ + oddsBranch(5, "corner", "open", "open_corner_line", includePrice, "open_corner_price_a", "open_corner_price_b") + """
                union all
                """ + oddsBranch(6, "corner", "pre-match", "prematch_corner_line", includePrice, "prematch_corner_price_a", "prematch_corner_price_b") : "";

        return """
                select event_id
                from (
                """ + oddsBranch(1, "hdc", "open", "open_hdc_line", includePrice, "open_hdc_price_a", "open_hdc_price_b") + """
                union all
                """ + oddsBranch(2, "hdc", "pre-match", "prematch_hdc_line", includePrice, "prematch_hdc_price_a", "prematch_hdc_price_b") + """
                union all
                """ + oddsBranch(3, "ou", "open", "open_ou_line", includePrice, "open_ou_price_a", "open_ou_price_b") + """
                union all
                """ + oddsBranch(4, "ou", "pre-match", "prematch_ou_line", includePrice, "prematch_ou_price_a", "prematch_ou_price_b") + cornerBranches + """
                ) x
                group by event_id
                having count(distinct k) = %d
                """.formatted(requiredMatches);
    }

    private static String oddsBranch(
            int key,
            String market,
            String type,
            String lineParam,
            boolean includePrice,
            String priceAParam,
            String priceBParam
    ) {
        var priceClause = includePrice
                ? "\n                and price_a = :" + priceAParam + "\n                and price_b = :" + priceBParam
                : "";
        return """
                select event_id, %d k
                from event_odds
                where market = '%s'
                  and type = '%s'
                  and line = :%s%s
                """.formatted(key, market, type, lineParam, priceClause);
    }

    private static String indent(String value, int spaces) {
        var prefix = " ".repeat(spaces);
        return value.lines()
                .map(line -> prefix + line)
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");
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
