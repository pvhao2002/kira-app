package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.VersionPredictionResult;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AbstractLinePatternPredictionEngineTest {

    @Test
    void computeEventIdLoadsOddsFromDatabase() {
        var support = mock(PredictionEngineSupport.class);
        var completed = completed();
        var odds = targetOdds(100L, 200L);
        var scores = List.of(new ScoreMatchRow("2-1", 3));
        when(support.loadTargetOdds(100L)).thenReturn(odds);
        when(support.buildCompletedResult(odds, scores)).thenReturn(completed);

        var result = new TestEngine(support, scores).compute(100L);

        assertThat(result).isSameAs(completed);
        verify(support).loadTargetOdds(100L);
    }

    @Test
    void computeTargetOddsDoesNotLoadOddsFromDatabase() {
        var support = mock(PredictionEngineSupport.class);
        var completed = completed();
        var odds = targetOdds(null, null);
        var scores = List.of(new ScoreMatchRow("2-1", 3));
        when(support.buildCompletedResult(odds, scores)).thenReturn(completed);

        var result = new TestEngine(support, scores).compute(odds);

        assertThat(result).isSameAs(completed);
        verify(support, never()).loadTargetOdds(org.mockito.ArgumentMatchers.anyLong());
    }

    private static VersionPredictionResult completed() {
        return new VersionPredictionResult(
                "completed", "HOME", "OVER", List.of("2-1"), 1, 1, 3, "0#0", "2.5", null);
    }

    private static TargetEventOdds targetOdds(Long eventId, Long leagueId) {
        return new TargetEventOdds(
                eventId,
                leagueId,
                "0#0",
                "0#0",
                "2.5",
                "2.5",
                null,
                null,
                BigDecimal.valueOf(1.90),
                BigDecimal.valueOf(1.95),
                BigDecimal.valueOf(1.87),
                BigDecimal.valueOf(1.93),
                null,
                null,
                BigDecimal.valueOf(1.88),
                BigDecimal.valueOf(2.00),
                BigDecimal.valueOf(1.91),
                BigDecimal.valueOf(1.89),
                null,
                null
        );
    }

    private static final class TestEngine extends AbstractLinePatternPredictionEngine {
        private final List<ScoreMatchRow> scores;

        private TestEngine(PredictionEngineSupport support, List<ScoreMatchRow> scores) {
            super(support, mock(HistoricalScoreMatcher.class));
            this.scores = scores;
        }

        @Override
        protected List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds) {
            return scores;
        }

        @Override
        protected String missingRequirementsMessage(TargetEventOdds odds) {
            return "missing";
        }

        @Override
        protected boolean hasRequiredData(TargetEventOdds odds) {
            return true;
        }
    }
}
