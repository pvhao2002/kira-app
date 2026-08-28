package com.kira.bank.passwordvault.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.Map;

@Repository
public class PasswordVaultAuditRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PasswordVaultAuditRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public void record(Long userId, String action, String entityType, Object entityId,
                       Map<String, ?> metadata, AuditContext context) {
        jdbc.update("insert into audit_logs " +
                "(user_id, action, entity_type, entity_id, after_data, ip_address, user_agent, trace_id) " +
                "values (?, ?, ?, ?, ?, ?, ?, ?)",
            userId, action, entityType, entityId == null ? null : entityId.toString(), json(metadata),
            truncate(context.ipAddress(), 45), truncate(context.userAgent(), 500), truncate(MDC.get("traceId"), 64));
    }

    public long failedUnlocksSince(Long userId, Instant since) {
        Timestamp lastSuccess = jdbc.queryForObject(
            "select max(created_at) from audit_logs where user_id = ? and action = 'PASSWORD_VAULT_UNLOCK_SUCCESS' and created_at >= ?",
            Timestamp.class, userId, Timestamp.from(since));
        Instant effectiveSince = lastSuccess == null ? since : lastSuccess.toInstant();
        Long count = jdbc.queryForObject(
            "select count(*) from audit_logs where user_id = ? and action = 'PASSWORD_VAULT_UNLOCK_FAILED' and created_at >= ?",
            Long.class, userId, Timestamp.from(effectiveSince));
        return count == null ? 0 : count;
    }

    private String json(Map<String, ?> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record AuditContext(String ipAddress, String userAgent) {
        public static AuditContext empty() { return new AuditContext(null, null); }
    }
}
