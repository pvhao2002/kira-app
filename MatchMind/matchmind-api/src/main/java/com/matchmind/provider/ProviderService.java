package com.matchmind.provider;

import com.matchmind.shared.CacheConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProviderService {
    private final NamedParameterJdbcTemplate jdbc;

    public record ProviderView(UUID id, String code, String name, long models, long predictions, Instant lastCallbackAt,
                               Instant createdAt) {
    }

    private static final String VIEW_SQL = """
        SELECT p.id, p.code, p.name, p.created_at,
               (SELECT count(*) FROM ai_models m WHERE m.provider_id = p.id) AS models,
               (SELECT count(*) FROM predictions pr WHERE pr.provider_id = p.id) AS predictions,
               (SELECT max(r.received_at) FROM external_api_requests r WHERE r.provider_id = p.id) AS last_callback_at
        FROM providers p
        """;

    @Transactional(readOnly = true)
    public List<ProviderView> list() {
        return jdbc.query(VIEW_SQL + " ORDER BY p.name", (rs, i) -> view(rs));
    }

    /**
     * The provider id for a code, creating the provider on first use. Runs outside any transaction so the insert is
     * visible at once; ON CONFLICT absorbs a concurrent first call with the same code.
     */
    @Cacheable(CacheConfig.PROVIDER_IDS)
    public UUID resolve(String code) {
        return find(code).orElseGet(() -> {
            jdbc.update("INSERT INTO providers (code, name) VALUES (:code, :code) ON CONFLICT (code) DO NOTHING", Map.of("code", code));
            return find(code).orElseThrow();
        });
    }

    private Optional<UUID> find(String code) {
        return jdbc.queryForList("SELECT id FROM providers WHERE code = :code", Map.of("code", code), UUID.class).stream().findFirst();
    }

    private static ProviderView view(ResultSet rs) throws SQLException {
        Timestamp last = rs.getTimestamp("last_callback_at");
        return new ProviderView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
            rs.getLong("models"), rs.getLong("predictions"), last == null ? null : last.toInstant(),
            rs.getTimestamp("created_at").toInstant());
    }
}
