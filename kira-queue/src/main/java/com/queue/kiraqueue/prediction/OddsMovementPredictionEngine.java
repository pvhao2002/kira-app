package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Log
@Service
@RequiredArgsConstructor
public class OddsMovementPredictionEngine {

    private static final String VERSION_CODE = PredictJobMessage.VERSION_ODDS_MOVEMENT;

    private final PredictionEngineSupport support;
    private final OddsMovementMatcher matcher;

    @Transactional
    public void predict(long eventId) {
        var versionId = support.loadVersionId(VERSION_CODE);
        if (versionId.isEmpty()) {
            log.warning("Prediction version not found: " + VERSION_CODE);
            return;
        }

        var odds = support.loadTargetOdds(eventId);
        if (odds == null) {
            support.persistSkipped(eventId, versionId.get(), "Event not found");
            return;
        }

        if (!PredictionEngineSupport.hasRequiredOpenPrematchLines(odds)) {
            support.persistSkipped(eventId, versionId.get(), "Missing required open or pre-match hdc/ou lines");
            return;
        }

        if (!PredictionEngineSupport.hasRequiredOpenPrematchPrices(odds)) {
            support.persistSkipped(eventId, versionId.get(), "Missing required open or pre-match hdc/ou prices");
            return;
        }

        OddsMovementSignature signature;
        try {
            signature = OddsMovementSignature.from(odds);
        } catch (Exception ex) {
            support.persistSkipped(eventId, versionId.get(), "Cannot compute odds movement signature: " + ex.getMessage());
            return;
        }

        var topScores = matcher.findTopScores(eventId, signature);
        if (topScores.isEmpty()) {
            support.persistSkipped(eventId, versionId.get(), "No historical matches for odds movement pattern");
            return;
        }

        support.persistCompleted(eventId, versionId.get(), odds, topScores);
        log.info(() -> "Odds Movement prediction completed for event_id=" + eventId + ", scores=" + topScores.size());
    }
}
