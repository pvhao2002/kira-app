package com.queue.kiraqueue.dto;

import java.util.Map;

public record PredictUrlResponse(
        String url,
        String matchId,
        Long eventId,
        Map<String, MarketOddsSnapshot> odds,
        Map<String, VersionPredictionResult> predictions
) {
}
