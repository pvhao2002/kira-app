package com.queue.kiraqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.prediction.AbstractLinePatternPredictionEngine;
import com.queue.kiraqueue.prediction.ActivePredictionVersionCache;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.PredictionEngineSupport;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PredictServiceTest {

    @Test
    void fullJobCleansUpAfterRunningActiveVersions() {
        var versionCache = mock(ActivePredictionVersionCache.class);
        var engineRegistry = mock(PredictionEngineRegistry.class);
        var support = mock(PredictionEngineSupport.class);
        var noPrice = mock(AbstractLinePatternPredictionEngine.class);
        var withPrice = mock(AbstractLinePatternPredictionEngine.class);
        var leagueNoPrice = mock(AbstractLinePatternPredictionEngine.class);
        var activeVersions = activeVersions();
        when(versionCache.getActiveVersions()).thenReturn(activeVersions);
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.of(noPrice));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_PRICE)).thenReturn(Optional.of(withPrice));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE))
                .thenReturn(Optional.of(leagueNoPrice));

        new PredictService(new ObjectMapper(), versionCache, engineRegistry, support).predict("123");

        var ordered = inOrder(noPrice, withPrice, leagueNoPrice, support);
        ordered.verify(noPrice).predict(123L, 1L);
        ordered.verify(withPrice).predict(123L, 2L);
        ordered.verify(leagueNoPrice).predict(123L, 3L);
        ordered.verify(support).deleteEventIfNoCurrentPredictionRows(123L);
    }

    @Test
    void singleVersionJobDoesNotCleanupEvent() {
        var versionCache = mock(ActivePredictionVersionCache.class);
        var engineRegistry = mock(PredictionEngineRegistry.class);
        var support = mock(PredictionEngineSupport.class);
        var noPrice = mock(AbstractLinePatternPredictionEngine.class);
        when(versionCache.getActiveVersions()).thenReturn(activeVersions());
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.of(noPrice));

        new PredictService(new ObjectMapper(), versionCache, engineRegistry, support)
                .predict("{\"eventId\":123,\"versionCode\":\"NO_PRICE\"}");

        verify(noPrice).predict(123L, 1L);
        verify(support, never()).deleteEventIfNoCurrentPredictionRows(123L);
    }

    @Test
    void fullJobWithMissingEngineOnlyCleansUpAfterRemainingVersionsRun() {
        var versionCache = mock(ActivePredictionVersionCache.class);
        var engineRegistry = mock(PredictionEngineRegistry.class);
        var support = mock(PredictionEngineSupport.class);
        var withPrice = mock(AbstractLinePatternPredictionEngine.class);
        var leagueNoPrice = mock(AbstractLinePatternPredictionEngine.class);
        when(versionCache.getActiveVersions()).thenReturn(activeVersions());
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.empty());
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_PRICE)).thenReturn(Optional.of(withPrice));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE))
                .thenReturn(Optional.of(leagueNoPrice));

        new PredictService(new ObjectMapper(), versionCache, engineRegistry, support).predict("123");

        var ordered = inOrder(withPrice, leagueNoPrice, support);
        ordered.verify(withPrice).predict(123L, 2L);
        ordered.verify(leagueNoPrice).predict(123L, 3L);
        ordered.verify(support).deleteEventIfNoCurrentPredictionRows(123L);
    }

    private static List<ActivePredictionVersionCache.ActiveVersion> activeVersions() {
        return List.of(
                new ActivePredictionVersionCache.ActiveVersion(1L, PredictJobMessage.VERSION_NO_PRICE),
                new ActivePredictionVersionCache.ActiveVersion(2L, PredictJobMessage.VERSION_WITH_PRICE),
                new ActivePredictionVersionCache.ActiveVersion(3L, PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE)
        );
    }
}
