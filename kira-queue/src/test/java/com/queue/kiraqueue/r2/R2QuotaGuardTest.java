package com.queue.kiraqueue.r2;

import com.queue.kiraqueue.config.R2Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class R2QuotaGuardTest {

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    private R2QuotaGuard guard;

    @BeforeEach
    void setUp() {
        var properties = new R2Properties();
        properties.getQuota().setMaxStorageBytes(1000);
        properties.getQuota().setMaxClassAOpsMonth(10);
        guard = new R2QuotaGuard(jdbcTemplate, properties);
    }

    @Test
    void canUpload_whenNoRow_returnsTrue() {
        when(jdbcTemplate.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        assertTrue(guard.canUpload());
    }

    @Test
    void canUpload_whenOverStorageLimit_returnsFalseAndHalts() {
        when(jdbcTemplate.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(new R2QuotaGuard.QuotaRow("2026-05", 1000L, 0L, false)));

        assertFalse(guard.canUpload());
        assertFalse(guard.canUpload());

        verify(jdbcTemplate, atLeastOnce()).update(eq("""
            update r2_upload_quota
            set halted = 1
            where period = :period
            """), any(MapSqlParameterSource.class));
    }

    @Test
    void recordUpload_incrementsUsage() {
        when(jdbcTemplate.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        guard.recordUpload(500);

        var captor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).update(eq("""
            update r2_upload_quota
            set storage_bytes = storage_bytes + :bytes,
                class_a_ops = class_a_ops + 1
            where period = :period
            """), captor.capture());
        assertTrue(captor.getValue().hasValue("bytes"));
    }
}
