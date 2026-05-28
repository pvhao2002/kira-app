package com.queue.kiraqueue.prediction;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class OddsMovementMatcher {

    private static final String SQL_HISTORICAL_CANDIDATES = """
            select er.ft_goal_str,
                   hist_open_hdc.line  as open_hdc_line,
                   hist_pm_hdc.line    as prematch_hdc_line,
                   hist_open_ou.line   as open_ou_line,
                   hist_pm_ou.line     as prematch_ou_line
            from events e
                     inner join event_result er on er.event_id = e.event_id
                     inner join event_odds hist_open_hdc
                                on hist_open_hdc.event_id = e.event_id
                                    and hist_open_hdc.type = 'open'
                                    and hist_open_hdc.market = 'hdc'
                     inner join event_odds hist_pm_hdc
                                on hist_pm_hdc.event_id = e.event_id
                                    and hist_pm_hdc.type = 'pre-match'
                                    and hist_pm_hdc.market = 'hdc'
                     inner join event_odds hist_open_ou
                                on hist_open_ou.event_id = e.event_id
                                    and hist_open_ou.type = 'open'
                                    and hist_open_ou.market = 'ou'
                     inner join event_odds hist_pm_ou
                                on hist_pm_ou.event_id = e.event_id
                                    and hist_pm_ou.type = 'pre-match'
                                    and hist_pm_ou.market = 'ou'
            where e.event_id <> :event_id
              and er.ft_goal_str is not null
              and er.ft_goal_str <> ''
              and hist_open_hdc.line is not null and hist_open_hdc.line <> ''
              and hist_pm_hdc.line is not null and hist_pm_hdc.line <> ''
              and hist_open_ou.line is not null and hist_open_ou.line <> ''
              and hist_pm_ou.line is not null and hist_pm_ou.line <> ''
              and %s
              and %s
              and %s
              and %s
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
            """.formatted(
            priceClause("hist_open_hdc.price_a", "hist_open_hdc.price_b", "hdc_open_price_rel"),
            priceClause("hist_open_ou.price_a", "hist_open_ou.price_b", "ou_open_price_rel"),
            priceClause("hist_pm_hdc.price_a", "hist_pm_hdc.price_b", "hdc_pm_price_rel"),
            priceClause("hist_pm_ou.price_a", "hist_pm_ou.price_b", "ou_pm_price_rel")
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<ScoreMatchRow> findTopScores(long eventId, OddsMovementSignature signature) {
        var params = new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("hdc_open_price_rel", signature.hdcOpenPriceRel().name())
                .addValue("ou_open_price_rel", signature.ouOpenPriceRel().name())
                .addValue("hdc_pm_price_rel", signature.hdcPrematchPriceRel().name())
                .addValue("ou_pm_price_rel", signature.ouPrematchPriceRel().name());

        var candidates = jdbcTemplate.query(SQL_HISTORICAL_CANDIDATES, params, (rs, rowNum) ->
                new HistoricalOddsSnapshot(
                        rs.getString("ft_goal_str"),
                        rs.getString("open_hdc_line"),
                        rs.getString("prematch_hdc_line"),
                        rs.getString("open_ou_line"),
                        rs.getString("prematch_ou_line")
                )
        );

        var filtered = candidates.stream()
                .filter(snapshot -> matchesLineMovement(snapshot, signature))
                .toList();

        return filtered.stream()
                .collect(Collectors.groupingBy(HistoricalOddsSnapshot::ftGoalStr, Collectors.counting()))
                .entrySet()
                .stream()
                .sorted((a, b) -> {
                    int cmp = Long.compare(b.getValue(), a.getValue());
                    if (cmp != 0) {
                        return cmp;
                    }
                    return a.getKey().compareTo(b.getKey());
                })
                .limit(3)
                .map(e -> new ScoreMatchRow(e.getKey(), e.getValue().intValue()))
                .toList();
    }

    private static String priceClause(String priceA, String priceB, String paramName) {
        return """
                (case
                    when %1$s < %2$s then 'LT'
                    when %1$s > %2$s then 'GT'
                    else 'EQ'
                end) = :%3$s""".formatted(priceA, priceB, paramName);
    }

    static boolean matchesLineMovement(HistoricalOddsSnapshot snapshot, OddsMovementSignature signature) {
        try {
            if (OddsLineMovement.fromHdcLines(snapshot.openHdcLine(), snapshot.prematchHdcLine()) != signature.hdcLineMove()) {
                return false;
            }
            return OddsLineMovement.fromLines(snapshot.openOuLine(), snapshot.prematchOuLine()) == signature.ouLineMove();
        } catch (Exception ex) {
            return false;
        }
    }
}
