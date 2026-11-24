package com.matchmind.parlay;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ParlayControllerTest {
    private static ParlayController.Outcome settle(String stake, String... legs) {
        // legs: "price:RESULT"
        var parsed = java.util.Arrays.stream(legs).map(l -> l.split(":"))
            .map(p -> new ParlayController.Priced(new BigDecimal(p[0]), p[1])).toList();
        return ParlayController.settle(parsed, stake == null ? null : new BigDecimal(stake));
    }

    @Test
    void allLegsWinPaysTheProductOfThePrices() {
        var o = settle("100", "2.00:WIN", "1.80:WIN");
        assertThat(o.totalOdds()).isEqualByComparingTo("3.60");
        assertThat(o.result()).isEqualTo("WIN");
        assertThat(o.payout()).isEqualByComparingTo("360");
        assertThat(o.profit()).isEqualByComparingTo("260");
    }

    @Test
    void oneLosingLegLosesTheParlayEvenWhileOthersArePending() {
        var o = settle("100", "2.00:PENDING", "1.80:LOSS");
        assertThat(o.result()).isEqualTo("LOSS");
        assertThat(o.payout()).isEqualByComparingTo("0");
        assertThat(o.profit()).isEqualByComparingTo("-100");
    }

    @Test
    void aPendingLegKeepsItOpen() {
        var o = settle("100", "2.00:WIN", "1.80:PENDING");
        assertThat(o.result()).isEqualTo("PENDING");
        assertThat(o.payout()).isNull();
        assertThat(o.profit()).isNull();
    }

    @Test
    void halfResultsAndPushesScaleThePayout() {
        // HALF_WIN at 2.00 -> 1.5, PUSH -> 1, HALF_LOSS -> 0.5: 0.75 back
        var o = settle("100", "2.00:HALF_WIN", "1.90:PUSH", "1.80:HALF_LOSS");
        assertThat(o.result()).isEqualTo("LOSS");
        assertThat(o.payout()).isEqualByComparingTo("75");
        assertThat(settle("100", "1.90:PUSH", "1.80:VOID").result()).isEqualTo("PUSH");
        assertThat(settle("100", "2.00:HALF_WIN", "1.90:VOID").result()).isEqualTo("WIN");
    }

    @Test
    void withoutAStakeThereIsNoPayout() {
        var o = settle(null, "2.00:WIN", "1.80:WIN");
        assertThat(o.result()).isEqualTo("WIN");
        assertThat(o.payout()).isNull();
        assertThat(o.profit()).isNull();
        assertThat(o.totalOdds()).isEqualByComparingTo("3.60");
    }
}
