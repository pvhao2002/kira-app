package com.queue.kiraqueue.prediction;

import java.math.BigDecimal;

public record TargetEventOdds(
        Long eventId,
        String openHdcLine,
        String prematchHdcLine,
        String openOuLine,
        String prematchOuLine,
        BigDecimal openHdcPriceA,
        BigDecimal openHdcPriceB,
        BigDecimal openOuPriceA,
        BigDecimal openOuPriceB,
        BigDecimal prematchHdcPriceA,
        BigDecimal prematchHdcPriceB,
        BigDecimal prematchOuPriceA,
        BigDecimal prematchOuPriceB
) {
}
