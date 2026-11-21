package com.matchmind.provider;

import com.matchmind.security.ApiKeyAuthenticationFilter;
import com.matchmind.shared.AdminActions;
import com.matchmind.shared.AdminActions.Kind;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.CacheConfig;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
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
    private final AdminActions admin;

    /** {@code models} counts the models in use: merged and archived ones are left out unless archived rows are listed. */
    public record ProviderView(UUID id, String code, String name, long models, long predictions, Instant lastCallbackAt,
                               Instant createdAt, Instant archivedAt, String description, String status,
                               Instant disabledAt, String disabledReason, long activeKeys) {
    }

    public record CreateProvider(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 128) String name,
                                 @Size(max = 2000) String description) {
    }

    /** Every field is optional; a status change needs a reason. The code never changes. */
    public record UpdateProvider(@Size(min = 1, max = 128) String name, @Size(max = 2000) String description,
                                 @Pattern(regexp = "ACTIVE|DISABLED") String status, @Size(max = 500) String reason) {
    }

    private static final String VIEW_SQL = """
        SELECT p.id, p.code, p.name, p.created_at, p.archived_at, p.description, p.status, p.disabled_at, p.disabled_reason,
               (SELECT count(*) FROM provider_api_keys k WHERE k.provider_id = p.id AND k.status = 'ACTIVE') AS active_keys,
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

    @Transactional(readOnly = true)
    public ProviderView get(UUID id) {
        return jdbc.query(VIEW_SQL.formatted("AND m.merged_into_id IS NULL AND m.archived_at IS NULL") + " WHERE p.id = :id",
                new MapSqlParameterSource("id", id), (rs, i) -> view(rs))
            .stream().findFirst().orElseThrow(Kind.PROVIDER::notFound);
    }

    /**
     * Admin: hides a provider (its models and matches follow) or brings it back; logged with the reason. Idempotent.
     * Evicts the league dropdown, which lists only visible matches.
     */
    @CacheEvict(value = CacheConfig.LEAGUES, allEntries = true)
    @Transactional
    public ProviderView setArchived(UUID id, boolean archive, String reason, UUID actor) {
        admin.setArchived(Kind.PROVIDER, id, archive, reason, actor);
        return get(id);
    }

    /**
     * Admin: a provider an agent key can then be issued for. Its id is the same deterministic id {@link #resolve} gives
     * the code, so a cached id from an earlier (rejected) legacy call stays right. 409 when the code exists.
     */
    @Transactional
    public ProviderView create(CreateProvider r) {
        String code = ApiKeyAuthenticationFilter.providerCode(r.code());
        if (code == null) throw ApiException.badRequest("INVALID_PROVIDER", "Code must be 2-64 characters: a-z, 0-9, '-' or '_'");
        int inserted = jdbc.update("""
                INSERT INTO providers (id, code, name, description) VALUES (:id, :code, :name, :description) ON CONFLICT DO NOTHING""",
            new MapSqlParameterSource("id", idFor(code)).addValue("code", code).addValue("name", r.name().trim())
                .addValue("description", blankToNull(r.description())));
        if (inserted == 0) throw ApiException.conflict("PROVIDER_EXISTS", "A provider with this code already exists");
        return get(idFor(code));
    }

    /**
     * Admin: rename / describe, and disable or enable with a reason (logged). Nothing is evicted: the API key filter
     * reads the status on every request, so a disable is effective on the next call.
     */
    @Transactional
    public ProviderView update(UUID id, UpdateProvider r, UUID actor) {
        var state = jdbc.queryForList("SELECT status FROM providers WHERE id = :id FOR UPDATE", Map.of("id", id), String.class);
        if (state.isEmpty()) throw Kind.PROVIDER.notFound();
        boolean statusChange = r.status() != null && !r.status().equals(state.getFirst());
        String reason = blankToNull(r.reason());
        if (statusChange && reason == null) {
            throw ApiException.badRequest("REASON_REQUIRED", "Say why the provider is disabled or enabled");
        }
        if (r.name() != null && r.name().isBlank()) throw ApiException.badRequest("VALIDATION_ERROR", "Name must not be blank");
        jdbc.update("""
                UPDATE providers SET name = COALESCE(:name, name),
                       description = CASE WHEN :setDescription THEN :description ELSE description END,
                       updated_at = now() WHERE id = :id""",
            new MapSqlParameterSource("id", id).addValue("name", r.name() == null ? null : r.name().trim())
                .addValue("setDescription", r.description() != null).addValue("description", blankToNull(r.description())));
        if (statusChange) {
            boolean disable = "DISABLED".equals(r.status());
            jdbc.update("UPDATE providers SET status = :status, disabled_at = " + (disable ? "now()" : "NULL")
                    + ", disabled_reason = :reason WHERE id = :id",
                new MapSqlParameterSource("id", id).addValue("status", r.status()).addValue("reason", disable ? reason : null));
            admin.record(Kind.PROVIDER, id, disable ? "DISABLE" : "ENABLE", reason, actor, null);
        }
        return get(id);
    }

    /** Read on every external request, never cached, so a disable takes effect at once. False for an unknown id. */
    public boolean disabled(UUID id) {
        return jdbc.queryForList("SELECT 1 FROM providers WHERE id = :id AND status = 'DISABLED'", Map.of("id", id), Integer.class)
            .size() > 0;
    }

    /** 403 PROVIDER_DISABLED for a disabled provider (admin import uses it; the key filter covers agents). */
    public void requireEnabled(UUID id) {
        if (disabled(id)) throw new ApiException(HttpStatus.FORBIDDEN, "PROVIDER_DISABLED", "This provider is disabled");
    }

    /**
     * The provider id for a code. Nothing is written: a provider that does not exist yet gets a deterministic id
     * (derived from the code), and its row is only inserted by {@link #ensureExists} once a prediction is accepted, so
     * a rejected request never leaves an empty provider behind (UX-077).
     */
    @Cacheable(CacheConfig.PROVIDER_IDS)
    public UUID resolve(String code) {
        return find(code).orElseGet(() -> idFor(code));
    }

    private static UUID idFor(String code) {
        return UUID.nameUUIDFromBytes(("matchmind-provider:" + code).getBytes(StandardCharsets.UTF_8));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
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
        Timestamp last = rs.getTimestamp("last_callback_at"), archived = rs.getTimestamp("archived_at"),
            disabled = rs.getTimestamp("disabled_at");
        return new ProviderView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
            rs.getLong("models"), rs.getLong("predictions"), last == null ? null : last.toInstant(),
            rs.getTimestamp("created_at").toInstant(), archived == null ? null : archived.toInstant(),
            rs.getString("description"), rs.getString("status"), disabled == null ? null : disabled.toInstant(),
            rs.getString("disabled_reason"), rs.getLong("active_keys"));
    }
}
