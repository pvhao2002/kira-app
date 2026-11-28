package com.matchmind.shared;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * SQL fragments and math shared by every win-rate figure, so dashboard, models and reports agree.
 * Assumes alias {@code r} = current row of prediction_pick_results (LEFT JOINed, may be NULL).
 * HALF_WIN counts as WIN, HALF_LOSS as LOSS; PUSH, VOID and PENDING are outside the denominator.
 */
public final class Stats {
    public static final String CURRENT_RESULT_JOIN =
        " LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current ";
    public static final String WINS = "count(*) FILTER (WHERE r.result IN ('WIN','HALF_WIN'))";
    public static final String LOSSES = "count(*) FILTER (WHERE r.result IN ('LOSS','HALF_LOSS'))";
    public static final String SETTLED = "count(*) FILTER (WHERE r.result IS NOT NULL AND r.result <> 'PENDING')";
    public static final String PENDING = "count(pk.id) FILTER (WHERE r.result IS NULL OR r.result = 'PENDING')";
    public static final String PUSH_VOID = "count(*) FILTER (WHERE r.result IN ('PUSH','VOID'))";

    /**
     * UX-018 profit of one pick at a fixed stake of 1, NUMERIC throughout; NULL for VOID/PENDING/unsettled.
     * Needs aliases pk, o (odds snapshot) and r.
     */
    public static final String PICK_UNITS = "CASE r.result WHEN 'WIN' THEN (" + Sql.PRICE + ") - 1"
        + " WHEN 'HALF_WIN' THEN ((" + Sql.PRICE + ") - 1) / 2 WHEN 'PUSH' THEN 0 WHEN 'HALF_LOSS' THEN -0.5"
        + " WHEN 'LOSS' THEN -1 END";
    /** Sum of {@link #PICK_UNITS}, scale 3 like prices; NULL when nothing was staked. */
    public static final String UNITS = "round(sum(" + PICK_UNITS + "), 3)";
    /** Picks whose stake was placed: PUSH counts (stake returned), VOID does not (bet cancelled). */
    public static final String STAKED = "count(*) FILTER (WHERE r.result IN ('WIN','HALF_WIN','PUSH','HALF_LOSS','LOSS'))";
    /**
     * What a settled pick paid back per unit of its price, (1 + {@link #PICK_UNITS}) / price: a win 1, a loss 0, a half
     * win or half loss in between. Averaged, it compares straight with the bookmaker's probability without margin and
     * with a stated probability of (1 + expected return) / price on every line, Asian quarter lines included, where the
     * half-counted win rate does not. Aliases pk, o and r.
     */
    public static final String PICK_HIT = "(1 + (" + PICK_UNITS + ")) / (" + Sql.PRICE + ")";
    /** Average {@link #PICK_HIT} over wins and losses with halves (PUSH and VOID left out), 4 decimals; NULL without one. */
    public static final String HIT_RATE = "round(avg(" + PICK_HIT
        + ") FILTER (WHERE r.result IN ('WIN','HALF_WIN','HALF_LOSS','LOSS')), 4)";

    /**
     * UX-046 "latest counts": prediction alias p is counted unless a later prediction (order predicted_at, created_at,
     * id) has the same key: fixture (COALESCE(fixture_id, match id)), effective model (merge target, else itself),
     * prediction_type and match_minute (NULL = NULL for PRE_MATCH). Deliberately not filtered by the report's filters,
     * so narrowing dates never resurrects an older duplicate. An archived sibling match or archived merged model never
     * supersedes (archiving bad data must not also hide the good row it would replace).
     * Self-contained on p (no other alias needed), so any query over predictions can AND it.
     */
    public static final String COUNTED = counted("p");

    /** {@link #COUNTED} for another predictions alias. */
    public static String counted(String p) {
        return """
            NOT EXISTS (SELECT 1 FROM predictions q
              WHERE q.match_id IN (SELECT qm.id FROM matches qm WHERE qm.id = %1$s.match_id
                                   OR (qm.archived_at IS NULL AND qm.fixture_id =
                                       (SELECT pm.fixture_id FROM matches pm WHERE pm.id = %1$s.match_id)))
                AND q.ai_model_id IN (SELECT qa.id FROM ai_models qa WHERE (qa.archived_at IS NULL OR qa.id = %1$s.ai_model_id)
                                      AND COALESCE(qa.merged_into_id, qa.id) =
                                      (SELECT COALESCE(pa.merged_into_id, pa.id) FROM ai_models pa WHERE pa.id = %1$s.ai_model_id))
                AND q.prediction_type = %1$s.prediction_type AND q.match_minute IS NOT DISTINCT FROM %1$s.match_minute
                AND (q.predicted_at, q.created_at, q.id) > (%1$s.predicted_at, %1$s.created_at, %1$s.id))""".formatted(p);
    }

    private Stats() {
    }

    /** wins / (wins + losses) with 4 decimals; null when nothing decisive has been settled yet. */
    public static BigDecimal winRate(long wins, long losses) {
        long decisive = wins + losses;
        return decisive == 0 ? null : BigDecimal.valueOf(wins).divide(BigDecimal.valueOf(decisive), 4, RoundingMode.HALF_UP);
    }

    /** units / staked with 4 decimals; null when nothing was staked. */
    public static BigDecimal roi(BigDecimal units, long staked) {
        return units == null || staked == 0 ? null : units.divide(BigDecimal.valueOf(staked), 4, RoundingMode.HALF_UP);
    }

    public static BigDecimal ratio(long part, long total) {
        return total == 0 ? null : BigDecimal.valueOf(part).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP);
    }

    /** Fewest picks a group needs before it is judged against the market (FAVOUR / AVOID). */
    public static final int MIN_GROUP = 30;

    /**
     * 1 when a group's hit rate beats the market's average probability by more than two standard errors, -1 when it
     * trails by that much, 0 otherwise and below {@link #MIN_GROUP} picks: a smaller gap is what chance alone gives.
     */
    public static int versusMarket(long n, double hit, double market) {
        if (n < MIN_GROUP) return 0;
        double twoSe = 2 * Math.sqrt(market * (1 - market) / n);
        return hit - market > twoSe ? 1 : market - hit > twoSe ? -1 : 0;
    }
}
