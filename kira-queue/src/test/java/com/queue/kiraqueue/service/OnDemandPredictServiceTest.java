package com.queue.kiraqueue.service;

import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.dto.VersionPredictionResult;
import com.queue.kiraqueue.prediction.AbstractLinePatternPredictionEngine;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.PredictionEngineSupport;
import com.queue.kiraqueue.prediction.TargetEventOdds;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnDemandPredictServiceTest {

    @Mock
    private CrawEventServiceV2 crawEventServiceV2;

    @Mock
    private PredictionEngineRegistry engineRegistry;

    @Mock
    private PredictionEngineSupport predictionEngineSupport;

    @InjectMocks
    private OnDemandPredictService onDemandPredictService;

    @Test
    void predictWithoutRecrawlRunsAllThreeVersions() {
        var engine = mock(AbstractLinePatternPredictionEngine.class);
        var completed = new VersionPredictionResult(
                "completed", "HOME", "OVER", List.of("2-1"), 2, 2, 10, "0#0", "2.5", null);

        when(predictionEngineSupport.loadTargetOdds(100L)).thenReturn(mock(TargetEventOdds.class));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.of(engine));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_PRICE)).thenReturn(Optional.of(engine));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE)).thenReturn(Optional.of(engine));
        when(engine.compute(100L)).thenReturn(completed);

        var response = onDemandPredictService.predict(100L, false);

        assertThat(response.eventId()).isEqualTo(100L);
        assertThat(response.recrawled()).isFalse();
        assertThat(response.predictions()).hasSize(3);
        assertThat(response.predictions().get(PredictJobMessage.VERSION_NO_PRICE).status()).isEqualTo("completed");
        verify(crawEventServiceV2, never()).recrawlOdds(anyLong());
        verify(engine, org.mockito.Mockito.times(3)).compute(100L);
    }

    @Test
    void predictWithRecrawlCallsRecrawlFirst() {
        var engine = mock(AbstractLinePatternPredictionEngine.class);
        var skipped = new VersionPredictionResult(
                "skipped", null, null, null, null, null, null, null, null, "missing data");

        when(crawEventServiceV2.recrawlOdds(200L)).thenReturn(new CrawEventServiceV2.RecrawlOddsResult(true, null, 12));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.of(engine));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_PRICE)).thenReturn(Optional.of(engine));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE)).thenReturn(Optional.of(engine));
        when(engine.compute(200L)).thenReturn(skipped);

        var response = onDemandPredictService.predict(200L, true);

        assertThat(response.recrawled()).isTrue();
        verify(crawEventServiceV2).recrawlOdds(200L);
        verify(predictionEngineSupport, never()).loadTargetOdds(anyLong());
    }

    @Test
    void predictThrowsNotFoundWhenEventMissingAndNoRecrawl() {
        when(predictionEngineSupport.loadTargetOdds(999L)).thenReturn(null);

        assertThatThrownBy(() -> onDemandPredictService.predict(999L, false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Event not found");
    }
}
