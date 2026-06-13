package com.queue.kiraqueue.prediction;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HistoricalScoreMatcherTest {

    @Test
    void buildNoPriceSqlIncludesCornerJoinsWhenCornerLinesPresent() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", "9.5", "9.5",
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildNoPriceSql(odds, null);

        assertThat(sql).contains("hist_open_corner");
        assertThat(sql).contains("hist_pm_corner");
    }

    @Test
    void buildNoPriceSqlOmitsCornerJoinsWhenCornerLinesMissing() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildNoPriceSql(odds, null);

        assertThat(sql).contains("hist_open_hdc");
        assertThat(sql).contains("hist_pm_ou");
        assertThat(sql).doesNotContain("hist_open_corner");
        assertThat(sql).doesNotContain("hist_pm_corner");
    }

    @Test
    void buildWithPriceSqlOmitsCornerJoinsWhenCornerLinesMissing() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildWithPriceSql(odds, "and e.league_id = :league_id");

        assertThat(sql).contains("and e.league_id = :league_id");
        assertThat(sql).doesNotContain("hist_open_corner");
    }
}
