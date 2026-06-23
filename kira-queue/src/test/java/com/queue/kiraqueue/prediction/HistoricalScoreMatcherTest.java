package com.queue.kiraqueue.prediction;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HistoricalScoreMatcherTest {

    @Test
    void buildNoPriceSqlIncludesCornerBranchesWhenCornerLinesPresent() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", "9.5", "9.5",
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildNoPriceSql(odds, null);

        assertThat(sql).contains("union all");
        assertThat(sql).contains("market = 'corner'");
        assertThat(sql).contains("line = :open_corner_line");
        assertThat(sql).contains("line = :prematch_corner_line");
        assertThat(sql).contains("having count(distinct k) = 6");
    }

    @Test
    void buildNoPriceSqlOmitsCornerBranchesWhenCornerLinesMissing() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildNoPriceSql(odds, null);

        assertThat(sql).contains("market = 'hdc'");
        assertThat(sql).contains("market = 'ou'");
        assertThat(sql).contains("having count(distinct k) = 4");
        assertThat(sql).doesNotContain("market = 'corner'");
    }

    @Test
    void buildWithPriceSqlOmitsCornerBranchesWhenCornerLinesMissing() {
        var odds = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );

        var sql = HistoricalScoreMatcher.buildWithPriceSql(odds, "and e.league_id = :league_id");

        assertThat(sql).contains("and e.league_id = :league_id");
        assertThat(sql).contains("price_a = :open_hdc_price_a");
        assertThat(sql).contains("price_b = :prematch_ou_price_b");
        assertThat(sql).doesNotContain("market = 'corner'");
    }
}
