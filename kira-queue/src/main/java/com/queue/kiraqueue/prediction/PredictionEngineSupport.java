package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.util.OddConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class PredictionEngineSupport {

    static final String SQL_LOAD_VERSION_ID = """
            select prediction_version_id
            from prediction_version
            where code = :code
              and is_active = 1
            limit 1
            """;

    static final String SQL_LOAD_TARGET_ODDS = """
            select e.event_id,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.line end)         as open_hdc_line,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.line end)   as prematch_hdc_line,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.line end)           as open_ou_line,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.line end)      as prematch_ou_line,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_a end)       as open_hdc_price_a,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_b end)       as open_hdc_price_b,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_a end)        as open_ou_price_a,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_b end)        as open_ou_price_b,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_a end) as prematch_hdc_price_a,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_b end) as prematch_hdc_price_b,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_a end)  as prematch_ou_price_a,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_b end)  as prematch_ou_price_b
            from events e
                     left join event_odds eo on eo.event_id = e.event_id and eo.market in ('hdc', 'ou')
            where e.event_id = :event_id
            group by e.event_id
            """;

    private static final String SQL_UPSERT_PREDICTION = """
            insert into event_prediction (
                event_id, prediction_version_id, status,
                prematch_hdc_line, prematch_ou_line,
                prematch_hdc_price_a, prematch_hdc_price_b,
                prematch_ou_price_a, prematch_ou_price_b,
                hdc_pick, ou_pick, hdc_vote_count, ou_vote_count, match_sample_count, error_message
            ) values (
                :event_id, :prediction_version_id, :status,
                :prematch_hdc_line, :prematch_ou_line,
                :prematch_hdc_price_a, :prematch_hdc_price_b,
                :prematch_ou_price_a, :prematch_ou_price_b,
                :hdc_pick, :ou_pick, :hdc_vote_count, :ou_vote_count, :match_sample_count, :error_message
            )
            on duplicate key update status               = values(status),
                                    prematch_hdc_line    = values(prematch_hdc_line),
                                    prematch_ou_line     = values(prematch_ou_line),
                                    prematch_hdc_price_a = values(prematch_hdc_price_a),
                                    prematch_hdc_price_b = values(prematch_hdc_price_b),
                                    prematch_ou_price_a  = values(prematch_ou_price_a),
                                    prematch_ou_price_b  = values(prematch_ou_price_b),
                                    hdc_pick             = values(hdc_pick),
                                    ou_pick              = values(ou_pick),
                                    hdc_vote_count       = values(hdc_vote_count),
                                    ou_vote_count        = values(ou_vote_count),
                                    match_sample_count   = values(match_sample_count),
                                    error_message        = values(error_message),
                                    updated_at           = current_timestamp
            """;

    private static final String SQL_SELECT_PREDICTION_ID = """
            select event_prediction_id
            from event_prediction
            where event_id = :event_id
              and prediction_version_id = :prediction_version_id
            """;

    private static final String SQL_DELETE_SCORES = """
            delete from event_prediction_score
            where event_prediction_id = :event_prediction_id
            """;

    private static final String SQL_INSERT_SCORE = """
            insert into event_prediction_score (
                event_prediction_id, rank_no, ft_goal_str, match_count, hdc_pick, ou_pick
            ) values (
                :event_prediction_id, :rank_no, :ft_goal_str, :match_count, :hdc_pick, :ou_pick
            )
            """;

    private static final String HASH = "#";
    private static final String MINUS = "-";

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public Optional<Long> loadVersionId(String versionCode) {
        var ids = jdbcTemplate.query(
                SQL_LOAD_VERSION_ID,
                Map.of("code", versionCode),
                (rs, rowNum) -> rs.getLong("prediction_version_id")
        );
        return ids.stream().findFirst();
    }

    public TargetEventOdds loadTargetOdds(long eventId) {
        var rows = jdbcTemplate.query(
                SQL_LOAD_TARGET_ODDS,
                Map.of("event_id", eventId),
                (rs, rowNum) -> new TargetEventOdds(
                        rs.getLong("event_id"),
                        rs.getString("open_hdc_line"),
                        rs.getString("prematch_hdc_line"),
                        rs.getString("open_ou_line"),
                        rs.getString("prematch_ou_line"),
                        rs.getBigDecimal("open_hdc_price_a"),
                        rs.getBigDecimal("open_hdc_price_b"),
                        rs.getBigDecimal("open_ou_price_a"),
                        rs.getBigDecimal("open_ou_price_b"),
                        rs.getBigDecimal("prematch_hdc_price_a"),
                        rs.getBigDecimal("prematch_hdc_price_b"),
                        rs.getBigDecimal("prematch_ou_price_a"),
                        rs.getBigDecimal("prematch_ou_price_b")
                )
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void persistCompleted(long eventId, long versionId, TargetEventOdds odds, List<ScoreMatchRow> topScores) {
        var hdcCounter = new EnumMap<PredictionPick, Integer>(PredictionPick.class);
        var ouCounter = new EnumMap<PredictionPick, Integer>(PredictionPick.class);
        int maxSample = 0;

        for (var row : topScores) {
            var picks = picksForScore(row.ftGoalStr(), odds);
            hdcCounter.merge(picks.hdcPick(), 1, Integer::sum);
            ouCounter.merge(picks.ouPick(), 1, Integer::sum);
            maxSample = Math.max(maxSample, row.matchCount());
        }

        var finalHdc = majorityPick(hdcCounter);
        var finalOu = majorityPick(ouCounter);

        jdbcTemplate.update(SQL_UPSERT_PREDICTION, new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("prediction_version_id", versionId)
                .addValue("status", "completed")
                .addValue("prematch_hdc_line", odds.prematchHdcLine())
                .addValue("prematch_ou_line", odds.prematchOuLine())
                .addValue("prematch_hdc_price_a", odds.prematchHdcPriceA())
                .addValue("prematch_hdc_price_b", odds.prematchHdcPriceB())
                .addValue("prematch_ou_price_a", odds.prematchOuPriceA())
                .addValue("prematch_ou_price_b", odds.prematchOuPriceB())
                .addValue("hdc_pick", finalHdc.name())
                .addValue("ou_pick", finalOu.name())
                .addValue("hdc_vote_count", hdcCounter.getOrDefault(finalHdc, 0))
                .addValue("ou_vote_count", ouCounter.getOrDefault(finalOu, 0))
                .addValue("match_sample_count", maxSample)
                .addValue("error_message", null));

        var predictionId = jdbcTemplate.query(
                SQL_SELECT_PREDICTION_ID,
                Map.of("event_id", eventId, "prediction_version_id", versionId),
                (rs, rowNum) -> rs.getLong("event_prediction_id")
        ).getFirst();

        jdbcTemplate.update(SQL_DELETE_SCORES, Map.of("event_prediction_id", predictionId));

        int rank = 1;
        for (var row : topScores) {
            var picks = picksForScore(row.ftGoalStr(), odds);
            jdbcTemplate.update(SQL_INSERT_SCORE, new MapSqlParameterSource()
                    .addValue("event_prediction_id", predictionId)
                    .addValue("rank_no", rank++)
                    .addValue("ft_goal_str", row.ftGoalStr())
                    .addValue("match_count", row.matchCount())
                    .addValue("hdc_pick", picks.hdcPick().name())
                    .addValue("ou_pick", picks.ouPick().name()));
        }
    }

    public void persistSkipped(long eventId, long versionId, String message) {
        jdbcTemplate.update(SQL_UPSERT_PREDICTION, new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("prediction_version_id", versionId)
                .addValue("status", "skipped")
                .addValue("prematch_hdc_line", null)
                .addValue("prematch_ou_line", null)
                .addValue("prematch_hdc_price_a", null)
                .addValue("prematch_hdc_price_b", null)
                .addValue("prematch_ou_price_a", null)
                .addValue("prematch_ou_price_b", null)
                .addValue("hdc_pick", PredictionPick.NONE.name())
                .addValue("ou_pick", PredictionPick.NONE.name())
                .addValue("hdc_vote_count", null)
                .addValue("ou_vote_count", null)
                .addValue("match_sample_count", null)
                .addValue("error_message", message));
    }

    public PredictionScorePicks picksForScore(String ftGoalStr, TargetEventOdds odds) {
        var parts = ftGoalStr.split(MINUS);
        int homeScore = Integer.parseInt(parts[0].trim());
        int awayScore = Integer.parseInt(parts[1].trim());
        double totalScore = homeScore + awayScore;

        double ouLine = OddConverter.convertLine(odds.prematchOuLine());
        var ouPick = totalScore > ouLine ? PredictionPick.OVER : PredictionPick.UNDER;

        var hdcHome = OddConverter.convertLine(odds.prematchHdcLine().split(HASH)[0]);
        double adjustedHome = homeScore + hdcHome;
        var hdcPick = adjustedHome >= awayScore ? PredictionPick.HOME : PredictionPick.AWAY;

        return new PredictionScorePicks(hdcPick, ouPick);
    }

    public PredictionPick majorityPick(EnumMap<PredictionPick, Integer> counter) {
        return counter.entrySet().stream()
                .filter(e -> e.getKey() != PredictionPick.NONE)
                .max((e1, e2) -> {
                    int cmp = Integer.compare(e1.getValue(), e2.getValue());
                    if (cmp != 0) {
                        return cmp;
                    }
                    return e1.getKey().name().compareTo(e2.getKey().name());
                })
                .map(Map.Entry::getKey)
                .orElse(PredictionPick.NONE);
    }

    public static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public static boolean hasRequiredOpenPrematchLines(TargetEventOdds odds) {
        return !isBlank(odds.openHdcLine())
                && !isBlank(odds.prematchHdcLine())
                && !isBlank(odds.openOuLine())
                && !isBlank(odds.prematchOuLine());
    }

    public static boolean hasRequiredOpenPrematchPrices(TargetEventOdds odds) {
        return odds.openHdcPriceA() != null && odds.openHdcPriceB() != null
                && odds.openOuPriceA() != null && odds.openOuPriceB() != null
                && odds.prematchHdcPriceA() != null && odds.prematchHdcPriceB() != null
                && odds.prematchOuPriceA() != null && odds.prematchOuPriceB() != null;
    }
}
