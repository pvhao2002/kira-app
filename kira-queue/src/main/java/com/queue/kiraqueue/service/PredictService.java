package com.queue.kiraqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.prediction.BaseDataPredictionEngine;
import com.queue.kiraqueue.prediction.OddsMovementPredictionEngine;
import com.queue.kiraqueue.prediction.PredictionSettleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictService {

    private final ObjectMapper objectMapper;
    private final BaseDataPredictionEngine baseDataPredictionEngine;
    private final OddsMovementPredictionEngine oddsMovementPredictionEngine;
    private final PredictionSettleService predictionSettleService;

    public void predict(String payload) {
        var job = parseJob(payload);
        if (job.eventId() == null) {
            log.warning("Prediction job missing eventId: " + payload);
            return;
        }
        var version = job.versionCode() == null || job.versionCode().isBlank()
                ? PredictJobMessage.VERSION_BASE_DATA
                : job.versionCode();
        if (PredictJobMessage.VERSION_BASE_DATA.equals(version)) {
            baseDataPredictionEngine.predict(job.eventId());
            predictionSettleService.settleEvent(job.eventId());
            return;
        }
        if (PredictJobMessage.VERSION_ODDS_MOVEMENT.equals(version)) {
            oddsMovementPredictionEngine.predict(job.eventId());
            predictionSettleService.settleEvent(job.eventId());
            return;
        }
        log.warning("Unknown prediction version: " + version);
    }

    private PredictJobMessage parseJob(String payload) {
        if (payload == null || payload.isBlank()) {
            return new PredictJobMessage(null, PredictJobMessage.VERSION_BASE_DATA);
        }
        var trimmed = payload.trim();
        if (trimmed.startsWith("{")) {
            try {
                return objectMapper.readValue(trimmed, PredictJobMessage.class);
            } catch (Exception ex) {
                log.warning("Failed to parse prediction job JSON: " + ex.getMessage());
                return new PredictJobMessage(null, PredictJobMessage.VERSION_BASE_DATA);
            }
        }
        try {
            return new PredictJobMessage(Long.parseLong(trimmed), PredictJobMessage.VERSION_BASE_DATA);
        } catch (NumberFormatException ex) {
            log.warning("Invalid prediction job payload: " + payload);
            return new PredictJobMessage(null, PredictJobMessage.VERSION_BASE_DATA);
        }
    }
}
