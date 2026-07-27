package com.queue.kiraqueue.prediction;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.dto.VersionPredictionResult;
import com.queue.kiraqueue.util.OddConverter;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Log
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
                   e.league_id,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.line end)            as open_hdc_line,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.line end)        as prematch_hdc_line,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.line end)              as open_ou_line,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.line end)         as prematch_ou_line,
                   max(case when eo.market = 'corner' and eo.type = 'open' then eo.line end)           as open_corner_line,
                   max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.line end)     as prematch_corner_line,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_a end)            as open_hdc_price_a,
                   max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_b end)            as open_hdc_price_b,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_a end)              as open_ou_price_a,
                   max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_b end)              as open_ou_price_b,
                   max(case when eo.market = 'corner' and eo.type = 'open' then eo.price_a end)           as open_corner_price_a,
                   max(case when eo.market = 'corner' and eo.type = 'open' then eo.price_b end)           as open_corner_price_b,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_a end)        as prematch_hdc_price_a,
                   max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_b end)        as prematch_hdc_price_b,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_a end)           as prematch_ou_price_a,
                   max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_b end)           as prematch_ou_price_b,
                   max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.price_a end)        as prematch_corner_price_a,
                   max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.price_b end)        as prematch_corner_price_b
            from events e
                     left join event_odds eo on eo.event_id = e.event_id and eo.market in ('hdc', 'ou', 'corner')
            where e.event_id = :event_id
            group by e.event_id, e.league_id
            """;

    private static final String SQL_UPSERT_COMPLETED_PREDICTION = """
            insert into event_prediction (
                event_id,
                prediction_version_id,
                status,
                prematch_hdc_line,
                prematch_ou_line,
                open_hdc_line,
                open_ou_line,
                open_corner_line,
                prematch_corner_line,
                prematch_hdc_price_a,
                prematch_hdc_price_b,
                prematch_ou_price_a,
                prematch_ou_price_b,
                goal_str_pick,
                hdc_pick,
                ou_pick,
                hdc_vote_count,
                ou_vote_count,
                match_sample_count,
                error_message
            )
            values (
                :event_id,
                :prediction_version_id,
                'completed',
                :prematch_hdc_line,
                :prematch_ou_line,
                :open_hdc_line,
                :open_ou_line,
                :open_corner_line,
                :prematch_corner_line,
                :prematch_hdc_price_a,
                :prematch_hdc_price_b,
                :prematch_ou_price_a,
                :prematch_ou_price_b,
                :goal_str_pick,
                :hdc_pick,
                :ou_pick,
                :hdc_vote_count,
                :ou_vote_count,
                :match_sample_count,
                null
            )
            on duplicate key update
                status               = values(status),
                prematch_hdc_line    = values(prematch_hdc_line),
                prematch_ou_line     = values(prematch_ou_line),
                open_hdc_line        = values(open_hdc_line),
                open_ou_line         = values(open_ou_line),
                open_corner_line     = values(open_corner_line),
                prematch_corner_line = values(prematch_corner_line),
                prematch_hdc_price_a = values(prematch_hdc_price_a),
                prematch_hdc_price_b = values(prematch_hdc_price_b),
                prematch_ou_price_a  = values(prematch_ou_price_a),
                prematch_ou_price_b  = values(prematch_ou_price_b),
                goal_str_pick        = values(goal_str_pick),
                hdc_pick             = values(hdc_pick),
                ou_pick              = values(ou_pick),
                hdc_vote_count       = values(hdc_vote_count),
                ou_vote_count        = values(ou_vote_count),
                match_sample_count   = values(match_sample_count),
                error_message        = null,
                actual_ft_goal_str   = null,
                result_hdc           = null,
                result_ou            = null,
                settled_at           = null,
                updated_at           = current_timestamp
            """;

    private static final String SQL_DELETE_PREDICTION = """
            delete from event_prediction
            where event_id = :event_id
              and prediction_version_id = :prediction_version_id
            """;

    private static final String SQL_LOCK_EVENT = """
            select event_id
            from events
            where event_id = :event_id
            for update
            """;

    private static final String SQL_HAS_CURRENT_PREDICTION_ROWS = """
            select 1
            from event_prediction ep
                   inner join prediction_version pv
                              on pv.prediction_version_id = ep.prediction_version_id
            where ep.event_id = :event_id
              and pv.is_active = 1
              and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
            limit 1
            """;

    private static final String SQL_DELETE_EVENT_ODDS = """
            delete from event_odds
            where event_id = :event_id
            """;

    private static final String SQL_DELETE_EVENT_ODDS_TIMELINE = """
            delete from event_odds_timeline
            where event_id = :event_id
            """;

    private static final String SQL_DELETE_EVENT_RESULT = """
            delete from event_result
            where event_id = :event_id
            """;

    private static final String SQL_DELETE_EVENT_CRAWL_FAILED = """
            delete from event_crawl_failed
            where event_id = :event_id
            """;

    private static final String SQL_DELETE_EVENT_IF_NO_CURRENT_PREDICTIONS = """
            delete from events
            where event_id = :event_id
              and not exists (
                select 1
                from event_prediction ep
                       inner join prediction_version pv
                                  on pv.prediction_version_id = ep.prediction_version_id
                where ep.event_id = events.event_id
                  and pv.is_active = 1
                  and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
              )
            """;

    private static final String SQL_UPSERT_INCOMPLETE_PREDICTION = """
            insert into event_prediction (
                event_id,
                prediction_version_id,
                status,
                error_message
            )
            select e.event_id,
                   :prediction_version_id,
                   :status,
                   :error_message
            from events e
            where e.event_id = :event_id
            on duplicate key update
                status               = values(status),
                prematch_hdc_line    = null,
                prematch_ou_line     = null,
                open_hdc_line        = null,
                open_ou_line         = null,
                open_corner_line     = null,
                prematch_corner_line = null,
                prematch_hdc_price_a = null,
                prematch_hdc_price_b = null,
                prematch_ou_price_a  = null,
                prematch_ou_price_b  = null,
                goal_str_pick        = null,
                hdc_pick             = null,
                ou_pick              = null,
                hdc_vote_count       = null,
                ou_vote_count        = null,
                match_sample_count   = null,
                error_message        = values(error_message),
                actual_ft_goal_str   = null,
                result_hdc           = null,
                result_ou            = null,
                settled_at           = null,
                updated_at           = current_timestamp
            """;

    private static final String HASH = "#";
    private static final String MINUS = "-";
    private static final int ERROR_MESSAGE_MAX_LENGTH = 512;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

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
                        rs.getObject("league_id", Long.class),
                        rs.getString("open_hdc_line"),
                        rs.getString("prematch_hdc_line"),
                        rs.getString("open_ou_line"),
                        rs.getString("prematch_ou_line"),
                        rs.getString("open_corner_line"),
                        rs.getString("prematch_corner_line"),
                        rs.getBigDecimal("open_hdc_price_a"),
                        rs.getBigDecimal("open_hdc_price_b"),
                        rs.getBigDecimal("open_ou_price_a"),
                        rs.getBigDecimal("open_ou_price_b"),
                        rs.getBigDecimal("open_corner_price_a"),
                        rs.getBigDecimal("open_corner_price_b"),
                        rs.getBigDecimal("prematch_hdc_price_a"),
                        rs.getBigDecimal("prematch_hdc_price_b"),
                        rs.getBigDecimal("prematch_ou_price_a"),
                        rs.getBigDecimal("prematch_ou_price_b"),
                        rs.getBigDecimal("prematch_corner_price_a"),
                        rs.getBigDecimal("prematch_corner_price_b")
                )
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void updateCompleted(long eventId, long versionId, TargetEventOdds odds, List<ScoreMatchRow> topScores) {
        var result = buildCompletedResult(odds, topScores);
        if (!hasAnyUsefulPick(result)) {
            deletePrediction(eventId, versionId);
            log.info(() -> "Skip persisting prediction without hdc/ou pick for event_id="
                    + eventId + ", version_id=" + versionId);
            return;
        }
        var lineSnapshot = lineSnapshotValues(odds);
        jdbcTemplate.update(SQL_UPSERT_COMPLETED_PREDICTION, new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("prediction_version_id", versionId)
                .addValue("prematch_hdc_line", lineSnapshot.get("prematch_hdc_line"))
                .addValue("prematch_ou_line", lineSnapshot.get("prematch_ou_line"))
                .addValue("open_hdc_line", lineSnapshot.get("open_hdc_line"))
                .addValue("open_ou_line", lineSnapshot.get("open_ou_line"))
                .addValue("open_corner_line", lineSnapshot.get("open_corner_line"))
                .addValue("prematch_corner_line", lineSnapshot.get("prematch_corner_line"))
                .addValue("prematch_hdc_price_a", odds.prematchHdcPriceA())
                .addValue("prematch_hdc_price_b", odds.prematchHdcPriceB())
                .addValue("prematch_ou_price_a", odds.prematchOuPriceA())
                .addValue("prematch_ou_price_b", odds.prematchOuPriceB())
                .addValue("goal_str_pick", formatGoalStrPick(topScores))
                .addValue("hdc_pick", result.hdcPick())
                .addValue("ou_pick", result.ouPick())
                .addValue("hdc_vote_count", result.hdcVoteCount())
                .addValue("ou_vote_count", result.ouVoteCount())
                .addValue("match_sample_count", result.matchSampleCount()));
    }

    public VersionPredictionResult buildCompletedResult(TargetEventOdds odds, List<ScoreMatchRow> topScores) {
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

        return new VersionPredictionResult(
                "completed",
                finalHdc.name(),
                finalOu.name(),
                topScores.stream().map(ScoreMatchRow::ftGoalStr).toList(),
                hdcCounter.getOrDefault(finalHdc, 0),
                ouCounter.getOrDefault(finalOu, 0),
                maxSample,
                odds.prematchHdcLine(),
                odds.prematchOuLine(),
                null
        );
    }

    public VersionPredictionResult buildSkippedResult(String message) {
        return new VersionPredictionResult(
                "skipped",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                message
        );
    }

    public void updateSkipped(long eventId, long versionId, String message) {
        updateIncomplete(eventId, versionId, "skipped", message);
        log.info(() -> "Persist skipped prediction for event_id="
                + eventId + ", version_id=" + versionId + ": " + message);
    }

    public void updateFailed(long eventId, long versionId, String message) {
        updateIncomplete(eventId, versionId, "failed", message);
        log.info(() -> "Persist failed prediction for event_id="
                + eventId + ", version_id=" + versionId + ": " + message);
    }

    @Transactional
    public boolean deleteEventIfNoCurrentPredictionRows(long eventId) {
        var params = new MapSqlParameterSource("event_id", eventId);
        var lockedEventIds = jdbcTemplate.query(
                SQL_LOCK_EVENT,
                params,
                (rs, rowNum) -> rs.getLong("event_id")
        );
        if (lockedEventIds.isEmpty()) {
            return false;
        }
        var currentPredictionRows = jdbcTemplate.query(
                SQL_HAS_CURRENT_PREDICTION_ROWS,
                params,
                (rs, rowNum) -> rs.getInt(1)
        );
        if (!currentPredictionRows.isEmpty()) {
            return false;
        }

        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, params);
        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, params);
        jdbcTemplate.update(SQL_DELETE_EVENT_RESULT, params);
        jdbcTemplate.update(SQL_DELETE_EVENT_CRAWL_FAILED, params);

        int deleted = jdbcTemplate.update(SQL_DELETE_EVENT_IF_NO_CURRENT_PREDICTIONS, params);
        if (deleted > 0) {
            log.info(() -> "Deleted event without current prediction rows: event_id=" + eventId);
            return true;
        }
        return false;
    }

    private Map<String, Object> lineSnapshotValues(TargetEventOdds odds) {
        var values = new HashMap<String, Object>();
        values.put("prematch_hdc_line", odds.prematchHdcLine());
        values.put("prematch_ou_line", odds.prematchOuLine());
        values.put("open_hdc_line", odds.openHdcLine());
        values.put("open_ou_line", odds.openOuLine());
        values.put("open_corner_line", hasCornerLines(odds) ? odds.openCornerLine() : null);
        values.put("prematch_corner_line", hasCornerLines(odds) ? odds.prematchCornerLine() : null);
        return values;
    }

    /** @deprecated use {@link #updateCompleted} */
    @Deprecated
    public void persistCompleted(long eventId, long versionId, TargetEventOdds odds, List<ScoreMatchRow> topScores) {
        updateCompleted(eventId, versionId, odds, topScores);
    }

    /** @deprecated use {@link #updateSkipped} */
    @Deprecated
    public void persistSkipped(long eventId, long versionId, String message) {
        updateSkipped(eventId, versionId, message);
    }

    public String formatGoalStrPick(List<ScoreMatchRow> topScores) {
        var values = topScores.stream().map(ScoreMatchRow::ftGoalStr).toList();
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            return values.stream()
                    .map(value -> "\"" + value.replace("\"", "\\\"") + "\"")
                    .collect(Collectors.joining(",", "[", "]"));
        }
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

    public static boolean hasRequiredHdcOuLines(TargetEventOdds odds) {
        return !isBlank(odds.openHdcLine())
                && !isBlank(odds.prematchHdcLine())
                && !isBlank(odds.openOuLine())
                && !isBlank(odds.prematchOuLine());
    }

    public static boolean hasCornerLines(TargetEventOdds odds) {
        return !isBlank(odds.openCornerLine())
                && !isBlank(odds.prematchCornerLine());
    }

    public static boolean hasRequiredOpenPrematchLines(TargetEventOdds odds) {
        if (!hasRequiredHdcOuLines(odds)) {
            return false;
        }
        if (hasCornerLines(odds)) {
            return true;
        }
        return isBlank(odds.openCornerLine()) && isBlank(odds.prematchCornerLine());
    }

    public static boolean hasRequiredHdcOuPrices(TargetEventOdds odds) {
        return odds.openHdcPriceA() != null && odds.openHdcPriceB() != null
                && odds.openOuPriceA() != null && odds.openOuPriceB() != null
                && odds.prematchHdcPriceA() != null && odds.prematchHdcPriceB() != null
                && odds.prematchOuPriceA() != null && odds.prematchOuPriceB() != null;
    }

    public static boolean hasCornerPrices(TargetEventOdds odds) {
        return odds.openCornerPriceA() != null && odds.openCornerPriceB() != null
                && odds.prematchCornerPriceA() != null && odds.prematchCornerPriceB() != null;
    }

    public static boolean hasRequiredOpenPrematchPrices(TargetEventOdds odds) {
        if (!hasRequiredHdcOuPrices(odds)) {
            return false;
        }
        if (hasCornerLines(odds)) {
            return hasCornerPrices(odds);
        }
        return odds.openCornerPriceA() == null && odds.openCornerPriceB() == null
                && odds.prematchCornerPriceA() == null && odds.prematchCornerPriceB() == null;
    }

    private void deletePrediction(long eventId, long versionId) {
        jdbcTemplate.update(SQL_DELETE_PREDICTION, new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("prediction_version_id", versionId));
    }

    private void updateIncomplete(long eventId, long versionId, String status, String message) {
        jdbcTemplate.update(SQL_UPSERT_INCOMPLETE_PREDICTION, new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("prediction_version_id", versionId)
                .addValue("status", status)
                .addValue("error_message", truncateErrorMessage(message)));
    }

    private static String truncateErrorMessage(String message) {
        if (message == null || message.length() <= ERROR_MESSAGE_MAX_LENGTH) {
            return message;
        }
        return message.substring(0, ERROR_MESSAGE_MAX_LENGTH);
    }

    private static boolean hasAnyUsefulPick(VersionPredictionResult result) {
        return isUsefulPick(result.hdcPick()) || isUsefulPick(result.ouPick());
    }

    private static boolean isUsefulPick(String pick) {
        return pick != null && !pick.isBlank() && !PredictionPick.NONE.name().equals(pick);
    }
}
