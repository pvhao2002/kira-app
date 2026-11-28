package com.matchmind.settlement;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Authoritative, deterministic settlement of one pick. Pure function: no I/O, no clock, so the same input always
 * yields the same outcome and the calculation can be replayed for audits.
 * <p>
 * Conventions:
 * <ul>
 *   <li>AH lines are quoted for the HOME team (-0.75 = home gives 0.75); the AWAY side gets the opposite line.</li>
 *   <li>FULL_MATCH basis settles on the final score; REMAINING_MATCH settles only on what was scored after the odds
 *       were captured (final - score at capture). A live AH is therefore never assumed to start from 0-0 on the
 *       full-match score.</li>
 *   <li>Quarter lines are split into two half stakes on line - 0.25 and line + 0.25.</li>
 * </ul>
 */
public final class SettlementEngine {
    public static final String VERSION = "settle-v2";
    private static final BigDecimal QUARTER = new BigDecimal("0.25");

    private SettlementEngine() {
    }

    public record Score(int home, int away) {
    }

    public record Input(String market, String pick, BigDecimal line, String basis, String matchStatus,
                        Score finalScore, Score finalCorners, Score scoreAtCapture, Score cornersAtCapture) {
    }

    /** {@code result} is one of WIN, LOSS, HALF_WIN, HALF_LOSS, PUSH, VOID or PENDING (not settleable yet). */
    public record Outcome(String result, String reason, Map<String, Object> details) {
        public boolean settled() {
            return !"PENDING".equals(result);
        }
    }

    public static Outcome settle(Input in) {
        validatePick(in.market(), in.pick());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("calculationVersion", VERSION);
        details.put("market", in.market());
        details.put("pick", in.pick());
        details.put("line", in.line());
        details.put("settlementBasis", in.basis());
        details.put("matchStatus", in.matchStatus());

        if ("CANCELLED".equals(in.matchStatus())) return new Outcome("VOID", "MATCH_CANCELLED", details);
        // A rescheduled match gets new picks: the old ones stay VOID (admin recalculate reopens them).
        if ("POSTPONED".equals(in.matchStatus())) return new Outcome("VOID", "MATCH_POSTPONED", details);
        if (!"FINISHED".equals(in.matchStatus())) return pending("MATCH_NOT_FINISHED", details);

        Basis basis = basisScore(in, details);
        if (basis.pendingReason() != null) return pending(basis.pendingReason(), details);
        Score score = basis.score();
        details.put("basisScore", score.home() + "-" + score.away());

        if ("1X2".equals(in.market())) {
            String winner = score.home() > score.away() ? "HOME" : score.home() < score.away() ? "AWAY" : "DRAW";
            details.put("outcome1x2", winner);
            return new Outcome(winner.equals(in.pick()) ? "WIN" : "LOSS", null, details);
        }
        if (in.line() == null) return pending("LINE_MISSING", details);
        return settleLine(in, score, details);
    }

    /** The score the pick is judged on, or why it cannot be judged yet. */
    private record Basis(Score score, String pendingReason) {
        static Basis pending(String reason) {
            return new Basis(null, reason);
        }
    }

    /**
     * FULL_MATCH: the final score (goals or corners). REMAINING_MATCH: only what happened after the odds were captured
     * (final - score at capture), so a live line is never settled as if the match had started 0-0.
     */
    private static Basis basisScore(Input in, Map<String, Object> details) {
        boolean corner = in.market().startsWith("CORNER_");
        Score fin = corner ? in.finalCorners() : in.finalScore();
        if (fin == null) return Basis.pending(corner ? "CORNER_RESULT_MISSING" : "FINAL_SCORE_MISSING");
        details.put(corner ? "finalCorners" : "finalScore", fin.home() + "-" + fin.away());

        if ("FULL_MATCH".equals(in.basis())) return new Basis(fin, null);
        if (!"REMAINING_MATCH".equals(in.basis())) throw new IllegalArgumentException("Unknown settlement basis: " + in.basis());

        Score capture = corner ? in.cornersAtCapture() : in.scoreAtCapture();
        if (capture == null) return Basis.pending("CAPTURE_SCORE_MISSING");
        details.put("atCapture", capture.home() + "-" + capture.away());
        if (fin.home() < capture.home() || fin.away() < capture.away()) return Basis.pending("FINAL_BELOW_CAPTURE_SCORE");
        return new Basis(new Score(fin.home() - capture.home(), fin.away() - capture.away()), null);
    }

    /** AH / OU (goals or corners): a quarter line is two half stakes on line - 0.25 and line + 0.25. */
    private static Outcome settleLine(Input in, Score score, Map<String, Object> details) {
        if (!isValidLine(in.line())) {
            throw new IllegalArgumentException("Line must be a multiple of 0.25: " + in.line());
        }
        List<BigDecimal> parts = isQuarter(in.line())
            ? List.of(in.line().subtract(QUARTER), in.line().add(QUARTER))
            : List.of(in.line());
        List<Map<String, Object>> legs = new ArrayList<>();
        List<Integer> signs = new ArrayList<>();
        for (BigDecimal part : parts) {
            BigDecimal margin = margin(in.market(), in.pick(), part, score);
            signs.add(margin.signum());
            Map<String, Object> leg = new LinkedHashMap<>();
            leg.put("line", part);
            leg.put("margin", margin);
            leg.put("result", resultOf(margin.signum()));
            legs.add(leg);
        }
        details.put("legs", legs);
        return new Outcome(combine(signs), null, details);
    }

    /** Picks allowed per market; anything else is a programming/validation error, never silently settled. */
    public static void validatePick(String market, String pick) {
        boolean ok = switch (market == null ? "" : market) {
            case "1X2" -> List.of("HOME", "DRAW", "AWAY").contains(pick);
            case "AH", "CORNER_AH" -> List.of("HOME", "AWAY").contains(pick);
            case "OU", "CORNER_OU" -> List.of("OVER", "UNDER").contains(pick);
            default -> throw new IllegalArgumentException("Unknown market: " + market);
        };
        if (!ok) throw new IllegalArgumentException("Pick " + pick + " is not valid for market " + market);
    }

    /** Handicap and total lines move in quarter steps: 4 x line must be a whole number. */
    public static boolean isValidLine(BigDecimal line) {
        return line.multiply(BigDecimal.valueOf(4)).stripTrailingZeros().scale() <= 0;
    }

    private static boolean isQuarter(BigDecimal line) {
        // x.25 / x.75: twice the line is not a whole number.
        return line.multiply(BigDecimal.TWO).stripTrailingZeros().scale() > 0;
    }

    private static BigDecimal margin(String market, String pick, BigDecimal line, Score s) {
        BigDecimal home = BigDecimal.valueOf(s.home());
        BigDecimal away = BigDecimal.valueOf(s.away());
        return switch (market) {
            case "AH", "CORNER_AH" -> "HOME".equals(pick) ? home.subtract(away).add(line) : away.subtract(home).subtract(line);
            case "OU", "CORNER_OU" -> "OVER".equals(pick) ? home.add(away).subtract(line) : line.subtract(home.add(away));
            default -> throw new IllegalArgumentException("Line market expected: " + market);
        };
    }

    private static String combine(List<Integer> signs) {
        if (signs.size() == 1) return resultOf(signs.getFirst());
        int a = signs.get(0), b = signs.get(1);
        if (a > 0 && b > 0) return "WIN";
        if (a < 0 && b < 0) return "LOSS";
        if (a == 0 && b == 0) return "PUSH";
        if (a >= 0 && b >= 0) return "HALF_WIN";
        if (a <= 0 && b <= 0) return "HALF_LOSS";
        // Adjacent half lines 0.5 apart cannot produce one WIN and one LOSS with whole-number scores.
        throw new IllegalStateException("Inconsistent quarter-line legs");
    }

    private static String resultOf(int marginSign) {
        return marginSign > 0 ? "WIN" : marginSign == 0 ? "PUSH" : "LOSS";
    }

    private static Outcome pending(String reason, Map<String, Object> details) {
        return new Outcome("PENDING", reason, details);
    }
}
