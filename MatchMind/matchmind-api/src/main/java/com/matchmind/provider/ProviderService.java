package com.matchmind.provider;

import com.matchmind.shared.CacheConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
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

    /** {@code models} counts the models in use: merged and archived ones are left out unless archived rows are listed. */
    public record ProviderView(UUID id, String code, String name, long models, long predictions, Instant lastCallbackAt,
                               Instant createdAt, Instant archivedAt) {
    }

    private static final String VIEW_SQL = """
        SELECT p.id, p.code, p.name, p.created_at, p.archived_at,
               (SELECT count(*) FROM ai_models m WHERE m.provider_id = p.id %s) AS models,
               (SELECT count(*) FROM predictions pr WHERE pr.provider_id = p.id) AS predictions,
               (SELECT max(r.received_at) FROM external_api_requests r WHERE r.provider_id = p.id) AS last_callback_at
        FROM providers p
        """;

    @Transactional(readOnly = true)
    public List<ProviderView> list(Boolean includeArchived) {
        boolean all = Boolean.TRUE.equals(includeArchived);
        return jdbc.query(VIEW_SQL.formatted(all ? "" : "AND m.merged_into_id IS NULL AND m.archived_at IS NULL")
            + (all ? "" : " WHERE p.archived_at IS NULL") + " ORDER BY p.name", (rs, i) -> view(rs));
    }

    /**
     * The provider id for a code. Nothing is written: a provider that does not exist yet gets a deterministic id
     * (derived from the code), and its row is only inserted by {@link #ensureExists} once a prediction is accepted, so
     * a rejected request never leaves an empty provider behind (UX-077).
     */
    @Cacheable(CacheConfig.PROVIDER_IDS)
    public UUID resolve(String code) {
        return find(code).orElseGet(() -> UUID.nameUUIDFromBytes(("matchmind-provider:" + code).getBytes(StandardCharsets.UTF_8)));
    }

    /**
     * Creates the provider row for an id from {@link #resolve}, inside the caller's transaction so a rejected
     * prediction rolls it back. ON CONFLICT absorbs a concurrent first call with the same code.
     */
    public void ensureExists(UUID id, String code) {
        jdbc.update("INSERT INTO providers (id, code, name) VALUES (:id, :code, :code) ON CONFLICT DO NOTHING",
            Map.of("id", id, "code", code));
    }

    /** False for a provider whose first request has not been accepted yet. */
    public boolean exists(UUID id) {
        return !jdbc.queryForList("SELECT 1 FROM providers WHERE id = :id", Map.of("id", id), Integer.class).isEmpty();
    }

    private Optional<UUID> find(String code) {
        return jdbc.queryForList("SELECT id FROM providers WHERE code = :code", Map.of("code", code), UUID.class).stream().findFirst();
    }

    private static ProviderView view(ResultSet rs) throws SQLException {
        Timestamp last = rs.getTimestamp("last_callback_at"), archived = rs.getTimestamp("archived_at");
        return new ProviderView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
            rs.getLong("models"), rs.getLong("predictions"), last == null ? null : last.toInstant(),
            rs.getTimestamp("created_at").toInstant(), archived == null ? null : archived.toInstant());
    }
}
