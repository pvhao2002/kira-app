package com.kira.bank.identity.application;

import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Per-user upload (lifetime bytes) and AI (calls per local day) quotas. Admins are exempt. Uses JdbcTemplate so
 * users.uploaded_bytes stays unmapped on the User entity and JPA saves can never overwrite it.
 */
@Service
@RequiredArgsConstructor
public class UsageQuotaService {
    static final long UPLOAD_LIMIT_BYTES = 524_288_000L;
    static final int AI_DAILY_LIMIT = 100;
    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final JdbcTemplate jdbc;

    public void checkUpload(Long userId, long bytes) {
        if (isAdmin(userId)) return;
        Long used = jdbc.queryForObject("SELECT uploaded_bytes FROM users WHERE id = ?", Long.class, userId);
        if (used == null || used + bytes > UPLOAD_LIMIT_BYTES) throw uploadExceeded();
    }

    public void reserveUpload(Long userId, long bytes) {
        if (isAdmin(userId)) return;
        int updated = jdbc.update("UPDATE users SET uploaded_bytes = uploaded_bytes + ?, updated_at = updated_at "
            + "WHERE id = ? AND uploaded_bytes + ? <= ?", bytes, userId, bytes, UPLOAD_LIMIT_BYTES);
        if (updated == 0) throw uploadExceeded();
    }

    public void refundUpload(Long userId, long bytes) {
        if (isAdmin(userId)) return;
        jdbc.update("UPDATE users SET uploaded_bytes = GREATEST(uploaded_bytes - ?, 0), updated_at = updated_at "
            + "WHERE id = ?", bytes, userId);
    }

    public void checkAi(Long userId, int count) {
        if (count <= 0 || isAdmin(userId)) return;
        Integer used = jdbc.queryForObject("SELECT COALESCE(MAX(call_count), 0) FROM user_ai_usage "
            + "WHERE user_id = ? AND usage_date = ?", Integer.class, userId, LocalDate.now(ZONE));
        if (used == null || used + count > AI_DAILY_LIMIT) throw aiExceeded();
    }

    public void consumeAi(Long userId, int count) {
        if (count <= 0 || isAdmin(userId)) return;
        LocalDate today = LocalDate.now(ZONE);
        jdbc.update("INSERT INTO user_ai_usage (user_id, usage_date, call_count) VALUES (?, ?, 0) "
            + "ON DUPLICATE KEY UPDATE call_count = call_count", userId, today);
        int updated = jdbc.update("UPDATE user_ai_usage SET call_count = call_count + ? "
            + "WHERE user_id = ? AND usage_date = ? AND call_count + ? <= ?", count, userId, today, count, AI_DAILY_LIMIT);
        if (updated == 0) throw aiExceeded();
    }

    public void refundAi(Long userId, int count) {
        if (count <= 0 || isAdmin(userId)) return;
        jdbc.update("UPDATE user_ai_usage SET call_count = GREATEST(call_count - ?, 0) "
            + "WHERE user_id = ? AND usage_date = ?", count, userId, LocalDate.now(ZONE));
    }

    private boolean isAdmin(Long userId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM user_roles ur "
            + "JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.name = 'ROLE_ADMIN')", Boolean.class, userId));
    }

    static long secondsUntilMidnight(ZonedDateTime now) {
        ZonedDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone());
        return Math.max(1, java.time.Duration.between(now, midnight).getSeconds());
    }

    private ApiException uploadExceeded() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "UPLOAD_QUOTA_EXCEEDED",
            "Bạn đã dùng hết dung lượng upload 500 MB");
    }

    private ApiException aiExceeded() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(secondsUntilMidnight(ZonedDateTime.now(ZONE))));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_DAILY_LIMIT_EXCEEDED",
            "Bạn đã dùng hết 100 lượt AI hôm nay", headers);
    }
}
