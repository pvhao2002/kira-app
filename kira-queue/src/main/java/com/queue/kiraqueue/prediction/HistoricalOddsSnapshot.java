package com.queue.kiraqueue.prediction;

public record HistoricalOddsSnapshot(
        String ftGoalStr,
        String openHdcLine,
        String prematchHdcLine,
        String openOuLine,
        String prematchOuLine
) {
}
