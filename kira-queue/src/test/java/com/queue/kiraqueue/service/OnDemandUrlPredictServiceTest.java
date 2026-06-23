package com.queue.kiraqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.dto.PredictUrlRequest;
import com.queue.kiraqueue.dto.VersionPredictionResult;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsSnapshotDto;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.prediction.AbstractLinePatternPredictionEngine;
import com.queue.kiraqueue.prediction.HistoricalScoreMatcher;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.PredictionEngineSupport;
import com.queue.kiraqueue.prediction.TargetEventOdds;
import com.queue.kiraqueue.prediction.WithLeagueNoPricePredictionEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnDemandUrlPredictServiceTest {

    @Mock
    private EventCrawlService eventCrawlService;

    @Mock
    private PredictionEngineRegistry engineRegistry;

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Test
    void predictUnknownUrlReturnsOddsAndSkipsLeagueVersion() {
        var noPrice = mock(AbstractLinePatternPredictionEngine.class);
        var withPrice = mock(AbstractLinePatternPredictionEngine.class);
        var support = new PredictionEngineSupport(null, new ObjectMapper());
        var leagueEngine = new WithLeagueNoPricePredictionEngine(support, mock(HistoricalScoreMatcher.class));
        var completed = new VersionPredictionResult(
                "completed", "HOME", "OVER", List.of("2-1"), 2, 2, 5, "0#0", "2.5", null);

        when(jdbcTemplate.query(anyString(), anyMap(), any(RowMapper.class))).thenReturn(List.of());
        when(eventCrawlService.crawlEvent(anyString(), any())).thenReturn(crawlResponse());
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_NO_PRICE)).thenReturn(Optional.of(noPrice));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_PRICE)).thenReturn(Optional.of(withPrice));
        when(engineRegistry.findEngine(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE)).thenReturn(Optional.of(leagueEngine));
        when(noPrice.compute(any(TargetEventOdds.class))).thenReturn(completed);
        when(withPrice.compute(any(TargetEventOdds.class))).thenReturn(completed);

        var service = new OnDemandUrlPredictService(eventCrawlService, engineRegistry, jdbcTemplate);
        var response = service.predict(new PredictUrlRequest("https://www.aiscore.com/match/foo/match123?x=1"));

        assertThat(response.matchId()).isEqualTo("match123");
        assertThat(response.eventId()).isNull();
        assertThat(response.odds().get("hdc").open().line()).isEqualTo("0#0");
        assertThat(response.odds().get("ou").preMatch().priceA()).isEqualTo("1.91");
        assertThat(response.odds().get("corner").open().line()).isEqualTo("9.5");
        assertThat(response.predictions().get(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE).status())
                .isEqualTo("skipped");
        assertThat(response.predictions().get(PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE).errorMessage())
                .isEqualTo("Missing league_id on event");
    }

    @Test
    void predictExistingUrlEnrichesEventIdAndLeagueId() throws Exception {
        var engine = mock(AbstractLinePatternPredictionEngine.class);
        var completed = new VersionPredictionResult(
                "completed", "HOME", "OVER", List.of("2-1"), 2, 2, 5, "0#0", "2.5", null);
        var rs = mock(ResultSet.class);
        when(rs.getLong("event_id")).thenReturn(123L);
        when(rs.getObject("league_id", Long.class)).thenReturn(456L);
        when(jdbcTemplate.query(anyString(), anyMap(), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(2);
            return List.of(mapper.mapRow(rs, 0));
        });
        when(eventCrawlService.crawlEvent(anyString(), any())).thenReturn(crawlResponse());
        when(engineRegistry.findEngine(anyString())).thenReturn(Optional.of(engine));
        when(engine.compute(any(TargetEventOdds.class))).thenReturn(completed);

        var service = new OnDemandUrlPredictService(eventCrawlService, engineRegistry, jdbcTemplate);
        var response = service.predict(new PredictUrlRequest("https://www.aiscore.com/match/foo/match123"));

        var captor = ArgumentCaptor.forClass(TargetEventOdds.class);
        verify(engine, org.mockito.Mockito.times(3)).compute(captor.capture());
        assertThat(response.eventId()).isEqualTo(123L);
        assertThat(captor.getAllValues()).allSatisfy(odds -> {
            assertThat(odds.eventId()).isEqualTo(123L);
            assertThat(odds.leagueId()).isEqualTo(456L);
        });
    }

    @Test
    void predictThrowsWhenOddsResponseIsEmpty() {
        when(jdbcTemplate.query(anyString(), anyMap(), any(RowMapper.class))).thenReturn(List.of());
        when(eventCrawlService.crawlEvent(anyString(), any())).thenReturn(MatchOddsResponseDto.empty());

        var service = new OnDemandUrlPredictService(eventCrawlService, engineRegistry, jdbcTemplate);

        assertThatThrownBy(() -> service.predict(new PredictUrlRequest("https://www.aiscore.com/match/foo/match123")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Empty odds crawl response");
        verify(engineRegistry, never()).findEngine(anyString());
    }

    private static MatchOddsResponseDto crawlResponse() {
        return new MatchOddsResponseDto(
                "match123",
                null,
                null,
                List.of(
                        new CrawlOddsSnapshotDto("open", "hdc", "0#0", "1.90", "1.95"),
                        new CrawlOddsSnapshotDto("pre-match", "hdc", "-0.5#+0.5", "1.88", "2.00"),
                        new CrawlOddsSnapshotDto("open", "ou", "2.5", "1.87", "1.93"),
                        new CrawlOddsSnapshotDto("pre-match", "ou", "2.75", "1.91", "1.89"),
                        new CrawlOddsSnapshotDto("open", "corner", "9.5", "1.90", "1.90"),
                        new CrawlOddsSnapshotDto("pre-match", "corner", "10.0", "1.92", "1.88"),
                        new CrawlOddsSnapshotDto("half-time", "hdc", "0#0", "1.80", "2.10")
                ),
                null,
                null
        );
    }
}
