package com.kira.bank.identity.application;

import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class UsageQuotaServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UsageQuotaService quota = new UsageQuotaService(jdbc);

    @BeforeEach
    void notAdmin() {
        adminIs(false);
    }

    private void adminIs(boolean admin) {
        when(jdbc.queryForObject(contains("EXISTS"), eq(Boolean.class), any(Object[].class))).thenReturn(admin);
    }

    @Test
    void adminIsExempt() {
        adminIs(true);
        quota.reserveUpload(1L, 10);
        quota.consumeAi(1L, 1);
        quota.refundAi(1L, 1);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void refundAiDecrementsTodayNeverBelowZero() {
        quota.refundAi(1L, 1);
        verify(jdbc).update(contains("GREATEST(call_count - ?, 0)"), eq(1), eq(1L), eq(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))));
    }

    @Test
    void reserveUploadRejectsWhenConditionalUpdateMatchesNoRow() {
        when(jdbc.update(contains("uploaded_bytes + ?"), any(Object[].class))).thenReturn(0);
        ApiException ex = assertThrows(ApiException.class, () -> quota.reserveUpload(1L, 10));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatus());
        assertEquals("UPLOAD_QUOTA_EXCEEDED", ex.getCode());
    }

    @Test
    void reserveUploadPassesWhenRowUpdated() {
        when(jdbc.update(contains("uploaded_bytes + ?"), any(Object[].class))).thenReturn(1);
        assertDoesNotThrow(() -> quota.reserveUpload(1L, 10));
    }

    @Test
    void consumeAiRejectsAtLimitWithRetryAfter() {
        when(jdbc.update(contains("call_count + ?"), any(Object[].class))).thenReturn(0);
        ApiException ex = assertThrows(ApiException.class, () -> quota.consumeAi(1L, 1));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
        assertEquals("AI_DAILY_LIMIT_EXCEEDED", ex.getCode());
        assertNotNull(ex.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
    }

    @Test
    void consumeAiZeroCountDoesNothing() {
        quota.consumeAi(1L, 0);
        verifyNoInteractions(jdbc);
    }

    @Test
    void secondsUntilMidnight() {
        ZoneId zone = UsageQuotaService.ZONE;
        assertEquals(30, UsageQuotaService.secondsUntilMidnight(ZonedDateTime.of(2026, 1, 1, 23, 59, 30, 0, zone)));
        assertEquals(86400, UsageQuotaService.secondsUntilMidnight(ZonedDateTime.of(2026, 1, 1, 0, 0, 0, 0, zone)));
    }
}
