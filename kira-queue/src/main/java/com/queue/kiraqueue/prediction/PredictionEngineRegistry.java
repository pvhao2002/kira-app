package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

@Component
public class PredictionEngineRegistry {

    private final Map<String, AbstractLinePatternPredictionEngine> enginesByCode;

    public PredictionEngineRegistry(
            NoPricePredictionEngine noPricePredictionEngine,
            WithPricePredictionEngine withPricePredictionEngine,
            WithLeagueNoPricePredictionEngine withLeagueNoPricePredictionEngine
    ) {
        enginesByCode = Map.of(
                PredictJobMessage.VERSION_NO_PRICE, noPricePredictionEngine,
                PredictJobMessage.VERSION_WITH_PRICE, withPricePredictionEngine,
                PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE, withLeagueNoPricePredictionEngine
        );
    }

    public Optional<AbstractLinePatternPredictionEngine> findEngine(String versionCode) {
        return Optional.ofNullable(enginesByCode.get(versionCode));
    }
}
