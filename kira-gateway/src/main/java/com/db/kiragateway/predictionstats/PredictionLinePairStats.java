package com.db.kiragateway.predictionstats;

public record PredictionLinePairStats(
        String prematchHdcLine,
        String prematchOuLine,
        String openHdcLine,
        String openOuLine,
        long bothWinCount,
        long bothSettledCount,
        double bothWinRate,
        long hdcHomePickCount,
        long hdcAwayPickCount,
        long ouOverPickCount,
        long ouUnderPickCount
) {
}
