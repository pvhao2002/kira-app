package com.matchmind.report;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PatternSignalTest {

    private static Map<String, Object> row(long wins, long losses) {
        Map<String, Object> r = new HashMap<>();
        r.put("wins", wins);
        r.put("losses", losses);
        ReportService.addRates(r);
        return r;
    }

    @Test
    void significantlyWorseThanOverallIsAWarning() {
        Map<String, Object> r = row(10, 30);
        ReportService.addSignal(r, new BigDecimal("0.5"), 20);
        assertThat((BigDecimal) r.get("lift")).isEqualByComparingTo("-0.25");
        assertThat((BigDecimal) r.get("z")).isEqualByComparingTo("-3.16");
        assertThat(r.get("signal")).isEqualTo("WARNING");
    }

    @Test
    void significantlyBetterThanOverallIsAStrength() {
        Map<String, Object> r = row(30, 10);
        ReportService.addSignal(r, new BigDecimal("0.5"), 20);
        assertThat((BigDecimal) r.get("z")).isEqualByComparingTo("3.16");
        assertThat(r.get("signal")).isEqualTo("STRENGTH");
    }

    @Test
    void smallSampleKeepsZButNoSignal() {
        Map<String, Object> r = row(3, 9);
        ReportService.addSignal(r, new BigDecimal("0.5"), 20);
        assertThat(r.get("z")).isNotNull();
        assertThat(r.get("signal")).isNull();
    }

    @Test
    void withinNoiseHasNoSignal() {
        Map<String, Object> r = row(22, 18);
        ReportService.addSignal(r, new BigDecimal("0.5"), 20);
        assertThat(r.get("signal")).isNull();
    }

    @Test
    void zJustUnderTheThresholdDoesNotFlagEvenIfItRoundsTo196() {
        // n 10000, baseline ~0.5 so se ~0.005: lift 0.4902 - 0.4999875 = -0.0097875 -> raw z -1.9575, shown as -1.96.
        Map<String, Object> r = new HashMap<>();
        r.put("wins", 4902L);
        r.put("losses", 5098L);
        r.put("winRate", new BigDecimal("0.4902"));
        ReportService.addSignal(r, new BigDecimal("0.4999875"), 20);
        assertThat((BigDecimal) r.get("z")).isEqualByComparingTo("-1.96");
        assertThat(r.get("signal")).isNull();
    }

    @Test
    void unknownOrDegenerateBaselineGivesNulls() {
        Map<String, Object> noBase = row(10, 30);
        ReportService.addSignal(noBase, null, 20);
        assertThat(noBase.get("lift")).isNull();
        assertThat(noBase.get("z")).isNull();
        assertThat(noBase.get("signal")).isNull();
        assertThat(noBase).containsKeys("lift", "z", "signal");

        Map<String, Object> allWins = row(40, 0);
        ReportService.addSignal(allWins, BigDecimal.ONE, 20);
        assertThat((BigDecimal) allWins.get("lift")).isEqualByComparingTo("0");
        assertThat(allWins.get("z")).isNull();
        assertThat(allWins.get("signal")).isNull();

        Map<String, Object> noDecisive = row(0, 0);
        ReportService.addSignal(noDecisive, new BigDecimal("0.5"), 20);
        assertThat(noDecisive.get("lift")).isNull();
        assertThat(noDecisive.get("z")).isNull();
    }
}
