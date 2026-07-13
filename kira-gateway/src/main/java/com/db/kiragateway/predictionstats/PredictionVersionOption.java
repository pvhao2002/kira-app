package com.db.kiragateway.predictionstats;

public record PredictionVersionOption(
        long predictionVersionId,
        String code,
        String displayName,
        boolean active
) {
}
