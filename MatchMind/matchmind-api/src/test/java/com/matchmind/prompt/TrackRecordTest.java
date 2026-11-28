package com.matchmind.prompt;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TrackRecordTest {
    @Test
    void judgesEveryGroupAgainstTheMarket() {
        List<TrackRecord.Pick> picks = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            picks.add(new TrackRecord.Pick(1, "AH HOME", "LIVE", 0.62, 0.50, "price 1.81-1.90", "edge 0.05 to 0.10",
                i < 30 ? 1 : 0));
            picks.add(new TrackRecord.Pick(1, "OU UNDER", "PRE_MATCH", 0.56, 0.52, "price 1.66-1.80", "edge 0 to 0.05",
                i < 14 ? 1 : 0));
        }
        for (int i = 0; i < 10; i++) {
            picks.add(new TrackRecord.Pick(2, "1X2 HOME", "PRE_MATCH", 0.70, 0.60, "price 1.66-1.80", "edge 0.10 to 0.15", 1));
        }

        String text = TrackRecord.format(picks);

        assertThat(text).contains("- Settled picks, last 60 days: 90. Hit = what a pick paid back divided by its price")
            .contains("- rank 1: hit 55% of 80; you said 59% (4 points too sure); market 51% -> no proven edge over the market.")
            .contains("- rank 2: hit 100% of 10; you said 70% (30 points too cautious); market 60%"
                + " -> too few picks to judge against the market.")
            .contains("- By market and side: 1X2 HOME 100% vs market 60% (n 10) · AH HOME 75% vs market 50% (n 40)"
                + " · OU UNDER 35% vs market 52% (n 40)")
            .contains("- By price: price 1.66-1.80 48% vs market 54% (n 50) · price 1.81-1.90 75% vs market 50% (n 40)")
            .contains("- By prediction type: LIVE 75% vs market 50% (n 40) · PRE_MATCH 48% vs market 54% (n 50)")
            .contains("- FAVOUR (beat the market by more than two standard errors, at least 30 picks): AH HOME 75% vs market"
                + " 50% (n 40) · price 1.81-1.90 75% vs market 50% (n 40) · edge 0.05 to 0.10 75% vs market 50% (n 40)")
            .contains("- AVOID (trailed the market by more than two standard errors, at least 30 picks): OU UNDER 35% vs"
                + " market 52% (n 40) · edge 0 to 0.05 35% vs market 52% (n 40)")
            .doesNotContain("lower your probabilities");
    }

    @Test
    void saysSoWhenNothingIsSettledYet() {
        assertThat(TrackRecord.format(List.of())).contains("No settled picks yet");
    }
}
