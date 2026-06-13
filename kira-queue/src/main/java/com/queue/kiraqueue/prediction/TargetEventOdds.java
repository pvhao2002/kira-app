package com.queue.kiraqueue.prediction;

import java.math.BigDecimal;

public record TargetEventOdds(
        Long eventId,
        Long leagueId,
        String openHdcLine,
        String prematchHdcLine,
        String openOuLine,
        String prematchOuLine,
        String openCornerLine,
        String prematchCornerLine,
        BigDecimal openHdcPriceA,
        BigDecimal openHdcPriceB,
        BigDecimal openOuPriceA,
        BigDecimal openOuPriceB,
        BigDecimal openCornerPriceA,
        BigDecimal openCornerPriceB,
        BigDecimal prematchHdcPriceA,
        BigDecimal prematchHdcPriceB,
        BigDecimal prematchOuPriceA,
        BigDecimal prematchOuPriceB,
        BigDecimal prematchCornerPriceA,
        BigDecimal prematchCornerPriceB
) {
}
