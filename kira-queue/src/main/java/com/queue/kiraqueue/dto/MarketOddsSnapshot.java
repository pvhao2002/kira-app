package com.queue.kiraqueue.dto;

public record MarketOddsSnapshot(
        OddsSnapshot open,
        OddsSnapshot preMatch
) {
}
