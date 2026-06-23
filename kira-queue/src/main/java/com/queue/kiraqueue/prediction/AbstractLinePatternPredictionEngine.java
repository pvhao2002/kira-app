package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.VersionPredictionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Log
@RequiredArgsConstructor
public abstract class AbstractLinePatternPredictionEngine {

    protected final PredictionEngineSupport support;
    protected final HistoricalScoreMatcher matcher;

    protected abstract List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds);

    protected abstract String missingRequirementsMessage(TargetEventOdds odds);

    protected abstract boolean hasRequiredData(TargetEventOdds odds);

    public VersionPredictionResult compute(long eventId) {
        var odds = support.loadTargetOdds(eventId);
        if (odds == null) {
            return support.buildSkippedResult("Event not found");
        }
        return compute(odds);
    }

    public VersionPredictionResult compute(TargetEventOdds odds) {
        if (!hasRequiredData(odds)) {
            return support.buildSkippedResult(missingRequirementsMessage(odds));
        }

        var eventId = odds.eventId() == null ? -1L : odds.eventId();
        var topScores = findTopScores(eventId, odds);
        if (topScores.isEmpty()) {
            return support.buildSkippedResult("No historical matches for odds pattern");
        }

        return support.buildCompletedResult(odds, topScores);
    }

    @Transactional
    public void predict(long eventId, long versionId) {
        var odds = support.loadTargetOdds(eventId);
        if (odds == null) {
            support.updateSkipped(eventId, versionId, "Event not found");
            return;
        }

        if (!hasRequiredData(odds)) {
            support.updateSkipped(eventId, versionId, missingRequirementsMessage(odds));
            return;
        }

        var topScores = findTopScores(eventId, odds);
        if (topScores.isEmpty()) {
            support.updateSkipped(eventId, versionId, "No historical matches for odds pattern");
            return;
        }

        support.updateCompleted(eventId, versionId, odds, topScores);
        log.info(() -> getClass().getSimpleName() + " completed for event_id=" + eventId
                + ", scores=" + topScores.size());
    }
}
