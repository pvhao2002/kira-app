package com.matchmind.settlement;

import com.matchmind.settlement.SettlementEngine.Input;
import com.matchmind.settlement.SettlementEngine.Score;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SettlementEngineTest {

    private static String full(String market, String pick, String line, int h, int a) {
        return SettlementEngine.settle(new Input(market, pick, line == null ? null : new BigDecimal(line), "FULL_MATCH",
            "FINISHED", new Score(h, a), null, null, null)).result();
    }

    @ParameterizedTest(name = "1X2 {0} at {1}-{2} -> {3}")
    @CsvSource({
        "HOME,2,1,WIN", "HOME,1,1,LOSS", "DRAW,1,1,WIN", "DRAW,0,1,LOSS", "AWAY,0,1,WIN", "AWAY,3,0,LOSS"})
    void oneXTwo(String pick, int h, int a, String expected) {
        assertThat(full("1X2", pick, null, h, a)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "AH {0} {1} at {2}-{3} -> {4}")
    @CsvSource({
        // whole and half lines, negative and positive
        "HOME,-1,2,1,PUSH", "HOME,-1,3,1,WIN", "HOME,-1,1,1,LOSS",
        "AWAY,-1,2,1,PUSH", "AWAY,-1,1,1,WIN",
        "HOME,0,1,1,PUSH", "AWAY,0,0,1,WIN",
        "HOME,-0.5,1,0,WIN", "HOME,-0.5,1,1,LOSS", "AWAY,-0.5,1,1,WIN",
        "HOME,1.5,0,1,WIN", "HOME,1.5,0,2,LOSS", "AWAY,1.5,0,2,WIN",
        // quarter lines
        "HOME,-0.25,1,1,HALF_LOSS", "HOME,-0.25,2,1,WIN", "AWAY,-0.25,1,1,HALF_WIN",
        "HOME,-0.75,1,0,HALF_WIN", "HOME,-0.75,2,0,WIN", "AWAY,-0.75,1,0,HALF_LOSS",
        "HOME,0.25,1,1,HALF_WIN", "HOME,0.25,0,1,LOSS", "AWAY,0.25,1,1,HALF_LOSS",
        "HOME,0.75,0,1,HALF_LOSS", "AWAY,0.75,0,1,HALF_WIN",
        "HOME,-1.25,2,1,HALF_LOSS", "HOME,-1.75,2,0,HALF_WIN"})
    void asianHandicap(String pick, String line, int h, int a, String expected) {
        assertThat(full("AH", pick, line, h, a)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "OU {0} {1} total {2}-{3} -> {4}")
    @CsvSource({
        "OVER,2.5,2,1,WIN", "OVER,2.5,1,1,LOSS", "UNDER,2.5,1,1,WIN",
        "OVER,3,2,1,PUSH", "UNDER,3,2,1,PUSH",
        "OVER,2.25,1,1,HALF_LOSS", "UNDER,2.25,1,1,HALF_WIN", "OVER,2.25,2,1,WIN",
        "OVER,2.75,2,1,HALF_WIN", "UNDER,2.75,2,1,HALF_LOSS", "UNDER,2.75,1,1,WIN",
        "OVER,0.25,0,0,HALF_LOSS", "UNDER,0.25,0,0,HALF_WIN", "OVER,0.75,1,0,HALF_WIN"})
    void overUnder(String pick, String line, int h, int a, String expected) {
        assertThat(full("OU", pick, line, h, a)).isEqualTo(expected);
    }

    @Test
    void liveAhUsesGoalsAfterCaptureNotFullScore() {
        // Live AH HOME -0.5 taken at 1-0, final 2-1: remaining score 1-1 -> LOSS (full-match reading would be WIN).
        var out = SettlementEngine.settle(new Input("AH", "HOME", new BigDecimal("-0.5"), "REMAINING_MATCH",
            "FINISHED", new Score(2, 1), null, new Score(1, 0), null));
        assertThat(out.result()).isEqualTo("LOSS");
        assertThat(out.details()).containsEntry("basisScore", "1-1").containsEntry("atCapture", "1-0");
    }

    @Test
    void liveAhQuarterLineOnRemainingGoals() {
        // AWAY +0.25 (home line -0.25) taken at 0-1, final 1-2: remaining 1-1 -> AWAY HALF_WIN.
        var out = SettlementEngine.settle(new Input("AH", "AWAY", new BigDecimal("-0.25"), "REMAINING_MATCH",
            "FINISHED", new Score(1, 2), null, new Score(0, 1), null));
        assertThat(out.result()).isEqualTo("HALF_WIN");
    }

    @Test
    void liveOuOnFullMatchBasisCountsGoalsBeforeCapture() {
        var out = SettlementEngine.settle(new Input("OU", "OVER", new BigDecimal("2.5"), "FULL_MATCH",
            "FINISHED", new Score(2, 1), null, new Score(2, 0), null));
        assertThat(out.result()).isEqualTo("WIN");
    }

    @Test
    void liveOuOnRemainingBasis() {
        var out = SettlementEngine.settle(new Input("OU", "UNDER", new BigDecimal("1.5"), "REMAINING_MATCH",
            "FINISHED", new Score(3, 1), null, new Score(2, 0), null));
        assertThat(out.details()).containsEntry("basisScore", "1-1");
        assertThat(out.result()).isEqualTo("LOSS");
    }

    @Test
    void cornerMarketsUseCorners() {
        var ah = SettlementEngine.settle(new Input("CORNER_AH", "HOME", new BigDecimal("-1.5"), "FULL_MATCH",
            "FINISHED", new Score(0, 0), new Score(7, 4), null, null));
        assertThat(ah.result()).isEqualTo("WIN");
        var ou = SettlementEngine.settle(new Input("CORNER_OU", "OVER", new BigDecimal("9.75"), "FULL_MATCH",
            "FINISHED", new Score(0, 0), new Score(6, 4), null, null));
        assertThat(ou.result()).isEqualTo("HALF_WIN");
        var live = SettlementEngine.settle(new Input("CORNER_OU", "OVER", new BigDecimal("3.5"), "REMAINING_MATCH",
            "FINISHED", new Score(1, 1), new Score(8, 5), new Score(1, 1), new Score(6, 4)));
        assertThat(live.result()).isEqualTo("LOSS");
    }

    @Test
    void missingCornerResultStaysPending() {
        var out = SettlementEngine.settle(new Input("CORNER_OU", "OVER", new BigDecimal("9.5"), "FULL_MATCH",
            "FINISHED", new Score(1, 0), null, null, null));
        assertThat(out.result()).isEqualTo("PENDING");
        assertThat(out.reason()).isEqualTo("CORNER_RESULT_MISSING");
        assertThat(out.settled()).isFalse();
    }

    @Test
    void cancelledOrPostponedIsVoidAndUnfinishedIsPending() {
        assertThat(SettlementEngine.settle(new Input("1X2", "HOME", null, "FULL_MATCH", "CANCELLED",
            null, null, null, null)).result()).isEqualTo("VOID");
        var postponed = SettlementEngine.settle(new Input("1X2", "HOME", null, "FULL_MATCH", "POSTPONED",
            null, null, null, null));
        assertThat(postponed.result()).isEqualTo("VOID");
        assertThat(postponed.reason()).isEqualTo("MATCH_POSTPONED");
        for (String status : new String[]{"SCHEDULED", "LIVE"}) {
            var out = SettlementEngine.settle(new Input("1X2", "HOME", null, "FULL_MATCH", status,
                new Score(1, 0), null, null, null));
            assertThat(out.result()).isEqualTo("PENDING");
            assertThat(out.reason()).isEqualTo("MATCH_NOT_FINISHED");
        }
    }

    @Test
    void remainingBasisWithoutCaptureScoreStaysPending() {
        var out = SettlementEngine.settle(new Input("AH", "HOME", BigDecimal.ZERO, "REMAINING_MATCH", "FINISHED",
            new Score(1, 0), null, null, null));
        assertThat(out.reason()).isEqualTo("CAPTURE_SCORE_MISSING");
    }

    @Test
    void finalBelowCaptureScoreIsNotSettled() {
        var out = SettlementEngine.settle(new Input("AH", "HOME", BigDecimal.ZERO, "REMAINING_MATCH", "FINISHED",
            new Score(1, 0), null, new Score(2, 0), null));
        assertThat(out.reason()).isEqualTo("FINAL_BELOW_CAPTURE_SCORE");
    }

    @Test
    void invalidPickForMarketIsRejected() {
        assertThatThrownBy(() -> full("AH", "DRAW", "0", 1, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> full("OU", "HOME", "2.5", 1, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> full("AH", "HOME", "0.3", 1, 1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deterministic() {
        Input in = new Input("AH", "HOME", new BigDecimal("-0.75"), "FULL_MATCH", "FINISHED", new Score(1, 0),
            null, null, null);
        assertThat(SettlementEngine.settle(in)).isEqualTo(SettlementEngine.settle(in));
    }
}
