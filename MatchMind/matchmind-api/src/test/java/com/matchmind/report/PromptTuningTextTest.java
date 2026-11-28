package com.matchmind.report;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTuningTextTest {
    /** A counter row as the report's SQL returns it: Long counts, NUMERIC rates (null when unknown). */
    private static Map<String, Object> row(String key, long wins, long losses, String winRate, String roi, String stated,
                                           String market, String hit) {
        Map<String, Object> r = new LinkedHashMap<>();
        if (key != null) r.put("key", key);
        r.put("wins", wins);
        r.put("losses", losses);
        r.put("winRate", winRate == null ? null : new BigDecimal(winRate));
        r.put("roi", roi == null ? null : new BigDecimal(roi));
        r.put("avgProbability", stated == null ? null : new BigDecimal(stated));
        r.put("avgMarketProbability", market == null ? null : new BigDecimal(market));
        r.put("hitRate", hit == null ? null : new BigDecimal(hit));
        return r;
    }

    private static Map<String, Object> rule(String text, Map<String, Object> follows, Map<String, Object> breaks) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("rule", "price");
        r.put("text", text);
        r.put("follows", follows);
        r.put("breaks", breaks);
        return r;
    }

    private static Map<String, Object> goals(long predictions, String expected, String actual) {
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("predictions", predictions);
        g.put("avgExpectedGoals", expected == null ? null : new BigDecimal(expected));
        g.put("avgActualGoals", actual == null ? null : new BigDecimal(actual));
        return g;
    }

    @Test
    void rendersRulesGroupsAndSignals() {
        Map<String, Object> total = row(null, 9, 7, "0.5625", "-0.0310", "0.6400", "0.5200", "0.5700");
        List<Map<String, Object>> rules = List.of(rule("Price above 1.65 and at most 1.90",
            row(null, 0, 1, "0.0000", "-1.0000", "0.6000", "0.5000", "0.0000"),
            row(null, 2, 1, "0.6667", "0.1333", "0.6200", "0.4800", "0.6700")));
        List<Map<String, Object>> dimensions = List.of(Map.of("by", "price", "title", "Price", "rows", List.of(
            row("price 1.66-1.80", 30, 10, "0.7500", "0.3000", "0.6000", "0.5500", "0.7500"),
            row("price 1.81-1.90", 5, 1, "0.8333", "0.4500", "0.6000", "0.5500", "0.8333"),
            row("price above 2.05", 8, 32, "0.2000", "-0.5000", "0.6500", "0.4500", "0.2000"))));

        String text = PromptTuningText.render("predicted from 2026-11-01 to now", total, rules, dimensions,
            goals(90, "2.81", "2.45"));

        assertThat(text).startsWith("MATCHMIND PROMPT TUNING REPORT").contains("AI_PREDICTION prompt")
            .contains("Scope: predicted from 2026-11-01 to now")
            .contains("hit = what the picks paid back divided by their price")
            .contains("OVERALL: won 56% of 16, ROI -3.1%, hit 57%, stated 64% (7 points too sure), market 52%")
            .contains("- Price above 1.65 and at most 1.90: followed won 0% of 1, ROI -100.0% | broken won 67% of 3, ROI +13.3%")
            .contains("PRICE\n- price 1.66-1.80: won 75% of 40, ROI +30.0%, hit 75%, stated 60% (15 points too cautious), market 55%")
            .contains("- price above 2.05: won 20% of 40, ROI -50.0%, hit 20%, stated 65% (45 points too sure), market 45%")
            // 6 picks are too few to name, however far from the market.
            .contains("FAVOUR (beat the market by more than two standard errors, at least 30 picks): price 1.66-1.80 hit 75% vs market 55% (n 40)\n")
            .contains("AVOID (trailed the market by more than two standard errors, at least 30 picks): price above 2.05 hit 20% vs market 45% (n 40)\n")
            .contains("expected 2.81 goals after the prediction, actual 2.45 (n 90): 0.36 too many")
            .contains("a smaller group, or one within two standard errors of the market, is noise")
            .doesNotContain("lower the stated probabilities where");
    }

    @Test
    void listsAGroupOnceWhenTwoGroupingsShareIt() {
        // Pre-match picks are one row of the minute grouping and one of the score grouping, with the same figures.
        Map<String, Object> preMatch = row("pre-match", 30, 10, "0.7500", "0.3000", "0.6000", "0.5500", "0.7500");
        List<Map<String, Object>> dimensions = List.of(Map.of("by", "minute", "title", "Minute", "rows", List.of(preMatch)),
            Map.of("by", "state", "title", "Score", "rows", List.of(preMatch)));

        String text = PromptTuningText.render("every prediction", row(null, 30, 10, "0.7500", "0.3000", "0.6000", "0.5500", "0.7500"),
            List.of(), dimensions, goals(0, null, null));

        assertThat(text).contains("FAVOUR (beat the market by more than two standard errors, at least 30 picks): pre-match hit 75% vs market 55% (n 40)\n");
    }

    @Test
    void saysNoWinOrLossYetWhenEverySettledPickPushedOrVoided() {
        Map<String, Object> total = row(null, 0, 0, null, null, "0.6000", "0.5000", null);
        total.put("settled", 2L);

        String text = PromptTuningText.render("every prediction", total, List.of(), List.of(), goals(0, null, null));

        assertThat(text).contains("No win or loss yet among the 2 settled picks (all push or void)")
            .doesNotContain("No settled picks match");
    }

    @Test
    void saysSoWhenNothingIsSettled() {
        String text = PromptTuningText.render("every prediction", row(null, 0, 0, null, null, null, null, null),
            List.of(rule("Price above 1.65 and at most 1.90", null, null)),
            List.of(Map.of("by", "price", "title", "Price", "rows", List.of())), goals(0, null, null));

        assertThat(text).contains("No settled picks match these filters").doesNotContain("null");
    }
}
