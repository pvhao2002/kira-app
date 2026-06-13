package com.queue.kiraqueue.dto;

import java.util.Map;

public record PredictEventResponse(
        long eventId,
        boolean recrawled,
        Map<String, VersionPredictionResult> predictions
) {
}
