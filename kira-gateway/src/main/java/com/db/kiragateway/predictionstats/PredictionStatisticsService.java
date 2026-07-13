package com.db.kiragateway.predictionstats;

import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class PredictionStatisticsService {

    private final PredictionStatisticsRepository repository;

    public PredictionStatisticsService(PredictionStatisticsRepository repository) {
        this.repository = repository;
    }

    public PredictionStatisticsResponse build(Long versionId, LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("from must be before or equal to to");
        }

        var versions = repository.findVersions();
        var selected = versionId != null
                ? repository.findVersion(versionId).orElseThrow(() -> new IllegalArgumentException("Prediction version not found"))
                : versions.stream().findFirst()
                        .orElseThrow(() -> new IllegalStateException("No prediction version configured"));

        var id = selected.predictionVersionId();
        return new PredictionStatisticsResponse(
                versions,
                selected,
                from,
                to,
                repository.latestSettledAt(id, from, to).orElse(null),
                repository.summary(id, from, to),
                repository.periodStats(id, from, to, PredictionStatisticsRepository.PeriodType.DAY),
                repository.periodStats(id, from, to, PredictionStatisticsRepository.PeriodType.WEEK),
                repository.periodStats(id, from, to, PredictionStatisticsRepository.PeriodType.MONTH),
                repository.linePairStats(id, from, to, 30)
        );
    }
}
