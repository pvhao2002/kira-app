package com.queue.kiraqueue.prediction;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PredictionEngineSupportCleanupTest {

    @Test
    void deleteEventIfNoCurrentPredictionRowsDeletesChildrenBeforeGuardedEventDelete() {
        var jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(123L), List.of());
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        var deleted = new PredictionEngineSupport(jdbcTemplate, new ObjectMapper())
                .deleteEventIfNoCurrentPredictionRows(123L);

        assertThat(deleted).isTrue();
        var ordered = inOrder(jdbcTemplate);
        ordered.verify(jdbcTemplate).query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class));
        ordered.verify(jdbcTemplate).query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class));
        ordered.verify(jdbcTemplate).update(org.mockito.ArgumentMatchers.contains("delete from event_odds\n"),
                any(MapSqlParameterSource.class));
        ordered.verify(jdbcTemplate).update(org.mockito.ArgumentMatchers.contains("delete from event_odds_timeline"),
                any(MapSqlParameterSource.class));
        ordered.verify(jdbcTemplate).update(org.mockito.ArgumentMatchers.contains("delete from event_result"),
                any(MapSqlParameterSource.class));
        ordered.verify(jdbcTemplate).update(org.mockito.ArgumentMatchers.contains("delete from event_crawl_failed"),
                any(MapSqlParameterSource.class));

        var eventDeleteSql = ArgumentCaptor.forClass(String.class);
        ordered.verify(jdbcTemplate).update(eventDeleteSql.capture(), any(MapSqlParameterSource.class));
        assertThat(eventDeleteSql.getValue())
                .contains("delete from events")
                .contains("not exists")
                .contains("NO_PRICE")
                .contains("WITH_PRICE")
                .contains("WITH_LEAGUE_NO_PRICE");
    }

    @Test
    void deleteEventIfNoCurrentPredictionRowsKeepsEventWhenCurrentPredictionExists() {
        var jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        when(jdbcTemplate.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(123L), List.of(1));

        var deleted = new PredictionEngineSupport(jdbcTemplate, new ObjectMapper())
                .deleteEventIfNoCurrentPredictionRows(123L);

        assertThat(deleted).isFalse();
        verify(jdbcTemplate, never()).update(anyString(), any(MapSqlParameterSource.class));
    }
}
