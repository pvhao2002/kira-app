package com.queue.kiraqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.prediction.ActivePredictionVersionCache;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.PredictionEngineSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.stereotype.Service;

import java.util.Comparator;

@Log
@Service
@RequiredArgsConstructor
public class PredictService {

    private final ObjectMapper objectMapper;
    private final ActivePredictionVersionCache versionCache;
    private final PredictionEngineRegistry engineRegistry;
    private final PredictionEngineSupport predictionEngineSupport;

    public void predict(String payload) {
        var job = parseJob(payload);
        if (job.eventId() == null) {
            log.warning("Prediction job missing eventId: " + payload);
            return;
        }

        if (job.versionCode() != null && !job.versionCode().isBlank()) {
            runVersion(job.eventId(), job.versionCode());
            return;
        }

        var activeVersions = versionCache.getActiveVersions().stream()
                .sorted(Comparator.comparingLong(ActivePredictionVersionCache.ActiveVersion::predictionVersionId))
                .toList();
        if (activeVersions.isEmpty()) {
            log.warning("Skip prediction cleanup for event_id=" + job.eventId() + ": no active prediction versions");
            return;
        }

        activeVersions.forEach(version -> runVersion(job.eventId(), version.code()));
        predictionEngineSupport.deleteEventIfNoCurrentPredictionRows(job.eventId());
    }

    private void runVersion(long eventId, String versionCode) {
        var engine = engineRegistry.findEngine(versionCode);
        if (engine.isEmpty()) {
            log.warning("No prediction engine registered for version: " + versionCode);
            return;
        }
        var versionId = versionCache.getActiveVersions().stream()
                .filter(version -> version.code().equals(versionCode))
                .map(ActivePredictionVersionCache.ActiveVersion::predictionVersionId)
                .findFirst();
        if (versionId.isEmpty()) {
            log.warning("Active prediction version not found: " + versionCode);
            return;
        }
        engine.get().predict(eventId, versionId.get());
    }

    private PredictJobMessage parseJob(String payload) {
        if (payload == null || payload.isBlank()) {
            return new PredictJobMessage(null, null);
        }
        var trimmed = payload.trim();
        if (trimmed.startsWith("{")) {
            try {
                return objectMapper.readValue(trimmed, PredictJobMessage.class);
            } catch (Exception ex) {
                log.warning("Failed to parse prediction job JSON: " + ex.getMessage());
                return new PredictJobMessage(null, null);
            }
        }
        try {
            return new PredictJobMessage(Long.parseLong(trimmed), null);
        } catch (NumberFormatException ex) {
            log.warning("Invalid prediction job payload: " + payload);
            return new PredictJobMessage(null, null);
        }
    }
}
