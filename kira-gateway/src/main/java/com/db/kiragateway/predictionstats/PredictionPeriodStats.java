package com.db.kiragateway.predictionstats;

import java.time.LocalDate;

public record PredictionPeriodStats(
        LocalDate periodStart,
        String label,
        long predictionCount,
        long totalWins,
        long totalLosses,
        long totalVoids,
        double totalWinRate,
        long hdcWins,
        long hdcLosses,
        double hdcWinRate,
        long ouWins,
        long ouLosses,
        double ouWinRate,
        long bothWinCount,
        double bothWinRate
) {
}
