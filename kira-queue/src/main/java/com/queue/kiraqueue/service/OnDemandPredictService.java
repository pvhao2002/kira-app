package com.queue.kiraqueue.service;

import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.dto.PredictEventResponse;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.dto.VersionPredictionResult;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.PredictionEngineSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OnDemandPredictService {

    private static final List<String> VERSION_CODES = List.of(
            PredictJobMessage.VERSION_NO_PRICE,
            PredictJobMessage.VERSION_WITH_PRICE,
            PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE
    );

    private final CrawEventServiceV2 crawEventServiceV2;
    private final PredictionEngineRegistry engineRegistry;
    private final PredictionEngineSupport predictionEngineSupport;

    public PredictEventResponse predict(long eventId, boolean recrawlOdd) {
        if (recrawlOdd) {
            crawEventServiceV2.recrawlOdds(eventId);
        } else if (predictionEngineSupport.loadTargetOdds(eventId) == null) {
            throw BusinessException.notFound("Event not found: " + eventId);
        }

        var predictions = new LinkedHashMap<String, VersionPredictionResult>();
        for (String versionCode : VERSION_CODES) {
            var engine = engineRegistry.findEngine(versionCode);
            if (engine.isEmpty()) {
                predictions.put(versionCode, predictionEngineSupport.buildSkippedResult(
                        "No prediction engine registered for version: " + versionCode));
                continue;
            }
            predictions.put(versionCode, engine.get().compute(eventId));
        }

        return new PredictEventResponse(eventId, recrawlOdd, Map.copyOf(predictions));
    }
}
