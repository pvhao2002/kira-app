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

    private Stats() {
    }

    /** wins / (wins + losses) with 4 decimals; null when nothing decisive has been settled yet. */
    public static BigDecimal winRate(long wins, long losses) {
        long decisive = wins + losses;
        return decisive == 0 ? null : BigDecimal.valueOf(wins).divide(BigDecimal.valueOf(decisive), 4, RoundingMode.HALF_UP);
    }

    public static BigDecimal ratio(long part, long total) {
        return total == 0 ? null : BigDecimal.valueOf(part).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP);
    }
}
