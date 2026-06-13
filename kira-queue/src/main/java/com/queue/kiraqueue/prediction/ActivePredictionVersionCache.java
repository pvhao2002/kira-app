package com.queue.kiraqueue.prediction;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ActivePredictionVersionCache {

    private static final Duration TTL = Duration.ofMinutes(15);

    private static final String SQL_ACTIVE_VERSIONS = """
            select prediction_version_id, code
            from prediction_version
            where is_active = 1
            order by sort_order, prediction_version_id
            """;

    public record ActiveVersion(long predictionVersionId, String code) {
    }

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private volatile List<ActiveVersion> cached = List.of();
    private volatile Instant expiresAt = Instant.EPOCH;

    public List<ActiveVersion> getActiveVersions() {
        if (Instant.now().isBefore(expiresAt) && !cached.isEmpty()) {
            return cached;
        }
        synchronized (this) {
            if (Instant.now().isBefore(expiresAt) && !cached.isEmpty()) {
                return cached;
            }
            cached = jdbcTemplate.query(
                    SQL_ACTIVE_VERSIONS,
                    (rs, rowNum) -> new ActiveVersion(
                            rs.getLong("prediction_version_id"),
                            rs.getString("code")
                    )
            );
            expiresAt = Instant.now().plus(TTL);
            return cached;
        }
    }
}
