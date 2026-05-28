package com.queue.kiraqueue.prediction;

public record OddsMovementSignature(
        OddsLineMovement hdcLineMove,
        OddsLineMovement ouLineMove,
        PriceRelation hdcOpenPriceRel,
        PriceRelation ouOpenPriceRel,
        PriceRelation hdcPrematchPriceRel,
        PriceRelation ouPrematchPriceRel
) {
    public static OddsMovementSignature from(TargetEventOdds odds) {
        return new OddsMovementSignature(
                OddsLineMovement.fromHdcLines(odds.openHdcLine(), odds.prematchHdcLine()),
                OddsLineMovement.fromLines(odds.openOuLine(), odds.prematchOuLine()),
                PriceRelation.fromPrices(odds.openHdcPriceA(), odds.openHdcPriceB()),
                PriceRelation.fromPrices(odds.openOuPriceA(), odds.openOuPriceB()),
                PriceRelation.fromPrices(odds.prematchHdcPriceA(), odds.prematchHdcPriceB()),
                PriceRelation.fromPrices(odds.prematchOuPriceA(), odds.prematchOuPriceB())
        );
    }
}
