package com.matchmind.report;

import com.matchmind.shared.Stats;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The prompt-tuning report as plain text, for pasting into an AI agent asked to improve the prediction prompt. Pure:
 * it only formats the rows {@link PromptTuningService} aggregated, so the figures match the JSON and the web tab.
 */
final class PromptTuningText {
    /** Groups a prompt rule can act on; rank, prompt version and model are context, not rules. */
    private static final Set<String> SIGNAL_DIMENSIONS = Set.of("side", "price", "edge", "probability", "line", "minute",
        "state", "league");

    private PromptTuningText() {
    }

    @SuppressWarnings("unchecked")
    static String render(String scope, Map<String, Object> total, List<Map<String, Object>> rules,
                         List<Map<String, Object>> dimensions, Map<String, Object> goals) {
        List<String> out = new ArrayList<>();
        out.add("MATCHMIND PROMPT TUNING REPORT - settled picks made with the AI_PREDICTION prompt");
        out.add("Scope: " + scope);
        if (decisive(total) == 0) {
            long settled = num(total.get("settled"));
            out.add(settled == 0 ? "No settled picks match these filters: nothing to tune yet."
                : "No win or loss yet among the %d settled picks (all push or void): nothing to tune yet.".formatted(settled));
            return String.join("\n", out);
        }
        out.add("Win rate = (wins + half wins) / (wins + half wins + losses + half losses). ROI = profit at a stake of 1"
            + " per pick / picks staked. Stated = the probability the agent gave; market = the bookmaker's probability"
            + " without margin, from the same odds snapshot; edge = (stated - market) x price, the expected return over the"
            + " market's (the edge of SELECTION RULES); hit = what the picks paid back divided"
            + " by their price ((1 + profit at a stake of 1) / price): a win 100%, a loss 0%, a half win or half loss in"
            + " between; it is the figure to compare with stated and market.");
        out.add("");
        out.add("OVERALL: " + stats(total));
        out.add("");
        out.add("SELECTION RULES (the prompt's rules; picks that followed vs broke each one):");
        for (Map<String, Object> r : rules) {
            out.add("- %s: followed %s | broken %s".formatted(r.get("text"), brief((Map<String, Object>) r.get("follows")),
                brief((Map<String, Object>) r.get("breaks"))));
        }
        // A set: pre-match picks are a row of the minute grouping and of the score grouping, with the same figures.
        Set<String> favour = new LinkedHashSet<>(), avoid = new LinkedHashSet<>();
        for (Map<String, Object> d : dimensions) {
            out.add("");
            out.add(String.valueOf(d.get("title")).toUpperCase(Locale.ROOT));
            List<Map<String, Object>> rows = (List<Map<String, Object>>) d.get("rows");
            if (rows.isEmpty()) out.add("- no settled picks");
            for (Map<String, Object> row : rows) {
                out.add("- %s: %s".formatted(row.get("key"), stats(row)));
                long n = decisive(row);
                BigDecimal hit = dec(row.get("hitRate")), market = dec(row.get("avgMarketProbability"));
                if (!SIGNAL_DIMENSIONS.contains(d.get("by")) || hit == null || market == null) continue;
                String signal = "%s hit %s vs market %s (n %d)".formatted(row.get("key"), pct(hit), pct(market), n);
                int verdict = Stats.versusMarket(n, hit.doubleValue(), market.doubleValue());
                if (verdict > 0) favour.add(signal);
                else if (verdict < 0) avoid.add(signal);
            }
        }
        out.add("");
        out.add(goalsLine(goals));
        out.add("");
        out.add("FAVOUR (beat the market by more than two standard errors, at least %d picks): %s".formatted(Stats.MIN_GROUP,
            favour.isEmpty() ? "none yet" : String.join(" · ", favour)));
        out.add("AVOID (trailed the market by more than two standard errors, at least %d picks): %s".formatted(Stats.MIN_GROUP,
            avoid.isEmpty() ? "none yet" : String.join(" · ", avoid)));
        out.add("");
        out.add("HOW TO USE: add or tighten a SELECTION RULE only for a group under AVOID, or where the picks that break a"
            + " rule beat those that follow it over 30 picks or more; a smaller group, or one within two standard errors of"
            + " the market, is noise. Never lower stated probabilities to fit this report: the edge gate in SELECTION RULES"
            + " decides. Compare the PROMPT VERSION groups before keeping a change.");
        return String.join("\n", out);
    }

    /** "won 57% of 80, ROI -2.0%, hit 58%, stated 65% (7 points too sure), market 54%"; n counts wins and losses with halves. */
    static String stats(Map<String, Object> row) {
        long n = decisive(row);
        if (n == 0) return "no win or loss yet";
        BigDecimal hit = dec(row.get("hitRate")), stated = dec(row.get("avgProbability"));
        BigDecimal market = dec(row.get("avgMarketProbability"));
        StringBuilder s = new StringBuilder(brief(row)).append(", hit ").append(pct(hit)); // non-null whenever n > 0
        if (stated != null) {
            s.append(", stated ").append(pct(stated));
            int gap = points(stated) - points(hit);
            if (gap >= 3) s.append(" (").append(gap).append(" points too sure)");
            else if (gap <= -3) s.append(" (").append(-gap).append(" points too cautious)");
        }
        if (market != null) s.append(", market ").append(pct(market));
        return s.toString();
    }

    /** "won 63% of 60, ROI +3.0%"; "none" for a rule side without picks. */
    private static String brief(Map<String, Object> row) {
        if (row == null) return "none";
        long n = decisive(row);
        if (n == 0) return "no win or loss yet";
        BigDecimal roi = dec(row.get("roi"));
        return "won " + pct(dec(row.get("winRate"))) + " of " + n + (roi == null ? "" : ", ROI " + signedPct(roi));
    }

    private static String goalsLine(Map<String, Object> goals) {
        BigDecimal expected = dec(goals.get("avgExpectedGoals")), actual = dec(goals.get("avgActualGoals"));
        if (expected == null || actual == null) return "EXPECTED GOALS: no finished prediction with a simulation yet.";
        BigDecimal diff = expected.subtract(actual).setScale(2, RoundingMode.HALF_UP);
        String verdict = diff.abs().compareTo(new BigDecimal("0.05")) < 0 ? "about right"
            : diff.abs().toPlainString() + (diff.signum() > 0 ? " too many" : " too few");
        return "EXPECTED GOALS (finished predictions with a simulation): expected %s goals after the prediction, actual %s (n %d): %s"
            .formatted(expected.toPlainString(), actual.toPlainString(), num(goals.get("predictions")), verdict);
    }

    private static long decisive(Map<String, Object> row) {
        return row == null ? 0 : num(row.get("wins")) + num(row.get("losses"));
    }

    private static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    private static BigDecimal dec(Object o) {
        return o == null ? null : o instanceof BigDecimal b ? b : new BigDecimal(o.toString());
    }

    private static int points(BigDecimal fraction) {
        return fraction.movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    private static String pct(BigDecimal fraction) {
        return points(fraction) + "%";
    }

    private static String signedPct(BigDecimal fraction) {
        BigDecimal p = fraction.movePointRight(2).setScale(1, RoundingMode.HALF_UP);
        return (p.signum() > 0 ? "+" : "") + p.toPlainString() + "%";
    }
}
