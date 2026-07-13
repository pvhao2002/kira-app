package com.db.kiragateway.predictionstats;

public record PredictionStatsSummary(
        long predictionCount,
        long settledMarketCount,
        long totalWins,
        long totalLosses,
        long totalVoids,
        double totalWinRate,
        long hdcWins,
        long hdcLosses,
        long hdcVoids,
        double hdcWinRate,
        long ouWins,
        long ouLosses,
        long ouVoids,
        double ouWinRate,
        long bothWinCount,
        double bothWinRate
) {
}
