package com.matchmind.security;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/** Individually revoked sessions (jti) until the token would have expired anyway. */
@Component
@RequiredArgsConstructor
public class RevokedTokens {
    private final JdbcTemplate jdbc;

    public void revoke(UUID tokenId, Instant tokenExpiresAt) {
        jdbc.update("INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?) ON CONFLICT DO NOTHING", tokenId,
            Timestamp.from(tokenExpiresAt));
    }

    public boolean isRevoked(UUID tokenId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = ?)",
            Boolean.class, tokenId));
    }

    @Scheduled(fixedDelayString = "PT1H")
    void purgeExpired() {
        jdbc.update("DELETE FROM revoked_tokens WHERE expires_at < now()");
    }
}
