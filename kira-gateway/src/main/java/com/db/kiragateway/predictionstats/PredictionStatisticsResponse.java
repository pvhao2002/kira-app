package com.db.kiragateway.predictionstats;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PredictionStatisticsResponse(
        List<PredictionVersionOption> versions,
        PredictionVersionOption selectedVersion,
        LocalDate from,
        LocalDate to,
        LocalDateTime latestSettledAt,
        PredictionStatsSummary summary,
        List<PredictionPeriodStats> daily,
        List<PredictionPeriodStats> weekly,
        List<PredictionPeriodStats> monthly,
        List<PredictionLinePairStats> linePairs
) {
}
