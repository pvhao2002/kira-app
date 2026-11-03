package com.queue.kiraqueue.util;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcBatchUtilsTest {
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private final List<MapSqlParameterSource> rows = List.of(new MapSqlParameterSource("a", 1), new MapSqlParameterSource("a", 2));

    @AfterEach
    void reset() {
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    @Test
    void outsideTransactionDeadlockFallsBackRowByRow() {
        when(jdbc.batchUpdate(anyString(), any(SqlParameterSource[].class)))
                .thenThrow(new DeadlockLoserDataAccessException("deadlock", null));

        JdbcBatchUtils.batchInsertSafe(jdbc, "insert", rows);

        verify(jdbc, times(2)).update(anyString(), any(SqlParameterSource.class));
    }

    @Test
    void insideTransactionDeadlockPropagatesInsteadOfSilentFallback() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        when(jdbc.batchUpdate(anyString(), any(SqlParameterSource[].class)))
                .thenThrow(new DeadlockLoserDataAccessException("deadlock", null));

        assertThatThrownBy(() -> JdbcBatchUtils.batchInsertSafe(jdbc, "insert", rows))
                .isInstanceOf(DeadlockLoserDataAccessException.class);
        verify(jdbc, never()).update(anyString(), any(SqlParameterSource.class));
    }

    @Test
    void insideTransactionRowFallbackDeadlockPropagates() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        when(jdbc.batchUpdate(anyString(), any(SqlParameterSource[].class)))
                .thenThrow(new org.springframework.dao.DuplicateKeyException("dup"));
        when(jdbc.update(anyString(), any(SqlParameterSource.class)))
                .thenThrow(new DeadlockLoserDataAccessException("deadlock", null));

        assertThatThrownBy(() -> JdbcBatchUtils.batchInsertSafe(jdbc, "insert", rows))
                .isInstanceOf(DeadlockLoserDataAccessException.class);
    }
}
