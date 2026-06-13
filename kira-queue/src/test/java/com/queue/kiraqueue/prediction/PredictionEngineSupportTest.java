package com.queue.kiraqueue.prediction;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class PredictionEngineSupportTest {

    @Test
    void hasRequiredHdcOuLinesRequiresAllFourLines() {
        var complete = odds("0#0", "0#0", "2.5", "2.5", null, null);
        var missingPrematchOu = odds("0#0", "0#0", "2.5", null, null, null);

        assertThat(PredictionEngineSupport.hasRequiredHdcOuLines(complete)).isTrue();
        assertThat(PredictionEngineSupport.hasRequiredHdcOuLines(missingPrematchOu)).isFalse();
    }

    @Test
    void hasRequiredOpenPrematchLinesAllowsMissingCornerWhenBothCornerLinesBlank() {
        var hdcOuOnly = odds("0#0", "0#0", "2.5", "2.5", null, null);

        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchLines(hdcOuOnly)).isTrue();
        assertThat(PredictionEngineSupport.hasCornerLines(hdcOuOnly)).isFalse();
    }

    @Test
    void hasRequiredOpenPrematchLinesRequiresBothCornerLinesWhenCornerPresent() {
        var withCorner = odds("0#0", "0#0", "2.5", "2.5", "9.5", "9.5");
        var partialCorner = odds("0#0", "0#0", "2.5", "2.5", "9.5", null);

        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchLines(withCorner)).isTrue();
        assertThat(PredictionEngineSupport.hasCornerLines(withCorner)).isTrue();
        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchLines(partialCorner)).isFalse();
    }

    @Test
    void hasRequiredOpenPrematchPricesRequiresCornerPricesOnlyWhenCornerLinesPresent() {
        var hdcOuOnly = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", null, null,
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), null, null,
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), null, null
        );
        var withCorner = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", "9.5", "9.5",
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"),
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90")
        );
        var missingCornerPrices = new TargetEventOdds(
                1L, 10L,
                "0#0", "0#0", "2.5", "2.5", "9.5", "9.5",
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"),
                bd("0.90"), bd("0.90"), bd("0.90"), bd("0.90"), null, null
        );

        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchPrices(hdcOuOnly)).isTrue();
        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchPrices(withCorner)).isTrue();
        assertThat(PredictionEngineSupport.hasRequiredOpenPrematchPrices(missingCornerPrices)).isFalse();
    }

    private static TargetEventOdds odds(
            String openHdc,
            String prematchHdc,
            String openOu,
            String prematchOu,
            String openCorner,
            String prematchCorner
    ) {
        return new TargetEventOdds(
                1L, 10L,
                openHdc, prematchHdc, openOu, prematchOu, openCorner, prematchCorner,
                null, null, null, null, null, null,
                null, null, null, null, null, null
        );
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
