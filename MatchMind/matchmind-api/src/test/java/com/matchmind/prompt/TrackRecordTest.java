package com.matchmind.prompt;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TrackRecordTest {
    @Test
    void saysHowSureTheAgentWasAndWhichGroupsToFavourOrAvoid() {
        List<TrackRecord.Pick> picks = new ArrayList<>();
        for (int i = 0; i < 6; i++) picks.add(new TrackRecord.Pick(1, "AH HOME", "LIVE", 0.70, 1.80, i < 5 ? 1 : 0));
        for (int i = 0; i < 6; i++) picks.add(new TrackRecord.Pick(1, "OU UNDER", "PRE_MATCH", 0.65, 1.95, i < 1 ? 1 : 0.5 * (i % 2)));
        String text = TrackRecord.format(picks);

        assertThat(text).contains("Settled picks, last 60 days: 12.");
        assertThat(text).contains("rank 1: won 63% of 12, you said 68% -> you were 5 points too sure");
        assertThat(text).contains("FAVOUR (won 60% or more, at least 6 picks): AH HOME 83% (n 6) · price 1.66-1.80 83% (n 6)");
        assertThat(text).contains("AVOID (won under 45%, at least 6 picks): OU UNDER 42% (n 6) · price 1.91-2.05 42% (n 6)");
        assertThat(text).contains("By prediction type: LIVE 83% (n 6) · PRE_MATCH 42% (n 6)");
    }

    @Test
    void saysSoWhenNothingIsSettledYet() {
        assertThat(TrackRecord.format(List.of())).contains("No settled picks yet");
    }

    @Test
    void bandsPricesTheWayTheRulesTalkAboutThem() {
        assertThat(TrackRecord.priceBand(1.65)).isEqualTo("1.65 or lower");
        assertThat(TrackRecord.priceBand(1.90)).isEqualTo("1.81-1.90");
        assertThat(TrackRecord.priceBand(1.91)).isEqualTo("1.91-2.05");
        assertThat(TrackRecord.priceBand(2.10)).isEqualTo("above 2.05");
    }
}
