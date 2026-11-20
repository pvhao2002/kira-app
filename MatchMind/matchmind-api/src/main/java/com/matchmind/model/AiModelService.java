package com.matchmind.model;

import com.matchmind.shared.AdminActions;
import com.matchmind.shared.AdminActions.Kind;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import com.matchmind.shared.TextRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiModelService {
    private final NamedParameterJdbcTemplate jdbc;
    private final AdminActions admin;

    public record RenameRequest(@NotNull @Size(max = 128) String displayName, @NotBlank @Size(max = 500) String reason) {
    }

    public record MergeRequest(@NotNull UUID targetModelId, @NotBlank @Size(max = 500) String reason) {
    }

    /**
     * {@code name} is the provider-supplied key; {@code displayName} is what to show (the admin's rename, else the name).
     * Stats cover the model and every model merged into it, and leave out predictions on archived matches.
     */
    public record ModelView(UUID id, UUID providerId, String providerName, String name, String displayName, String version,
                            String description, String status, long totalPredictions, long settledPicks, long wins,
                            long losses, long pendingPicks, BigDecimal winRate, Instant lastPredictionAt,
                            Instant createdAt, Instant updatedAt, Instant archivedAt, UUID mergedIntoId) {
    }

    /**
     * The model and the models merged into it (alias m = the surviving model). Same rules as {@code Filters}: archived
     * merged models and predictions on archived matches are left out unless archived rows are included.
     */
    private static String family(boolean all) {
        return "(SELECT c.id FROM ai_models c WHERE c.id = m.id OR (c.merged_into_id = m.id"
            + (all ? "" : " AND c.archived_at IS NULL") + "))";
    }

    private static String matchActive(boolean all) {
        return all ? "" : " AND NOT EXISTS (SELECT 1 FROM matches mt WHERE mt.id = pr.match_id AND mt.archived_at IS NOT NULL)";
    }

    private static String sql(boolean all) {
        return SQL.formatted(family(all), matchActive(all), Stats.SETTLED, Stats.WINS, Stats.LOSSES, Stats.PENDING,
            Stats.CURRENT_RESULT_JOIN);
    }

    private static final String SQL = """
        SELECT m.id, m.provider_id, p.name AS provider_name, m.name, COALESCE(m.display_name, m.name) AS display_name,
               m.version, m.description, m.status, m.created_at, m.updated_at, m.archived_at, m.merged_into_id,
               (SELECT count(*) FROM predictions pr WHERE pr.ai_model_id IN %1$s%2$s) AS total_predictions,
               (SELECT max(pr.predicted_at) FROM predictions pr WHERE pr.ai_model_id IN %1$s%2$s) AS last_prediction_at,
               s.settled, s.wins, s.losses, s.pending
        FROM ai_models m
        JOIN providers p ON p.id = m.provider_id
        LEFT JOIN LATERAL (
            SELECT %3$s AS settled, %4$s AS wins, %5$s AS losses, %6$s AS pending
            FROM predictions pr JOIN prediction_picks pk ON pk.prediction_id = pr.id %7$s
            WHERE pr.ai_model_id IN %1$s%2$s) s ON true
        """;

    /**
     * Hides merged and archived models (and those of an archived provider) unless {@code includeArchived}; naming the
     * provider unhides that provider, as in the reports.
     */
    @Transactional(readOnly = true)
    public List<ModelView> list(UUID providerId, Boolean includeArchived) {
        boolean all = Boolean.TRUE.equals(includeArchived);
        Sql.Where w = new Sql.Where().and("m.provider_id = :providerId", "providerId", providerId);
        if (!all) {
            w.and("m.merged_into_id IS NULL AND m.archived_at IS NULL");
            if (providerId == null) w.and("p.archived_at IS NULL");
        }
        return jdbc.query(sql(all) + w.sql() + " ORDER BY COALESCE(m.display_name, m.name), m.version", w.params, (rs, i) -> view(rs));
    }

    @Transactional(readOnly = true)
    public ModelView get(UUID id) {
        return jdbc.query(sql(false) + " WHERE m.id = :id", new MapSqlParameterSource("id", id), (rs, i) -> view(rs))
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("MODEL_NOT_FOUND", "AI model not found"));
    }

    // ------------------------------------------------------------------ admin writes (each logs one admin_actions row)

    /** Hides a model from lists and reports, or brings it back. Idempotent. */
    @Transactional
    public ModelView setArchived(UUID id, boolean archive, String reason, UUID actor) {
        admin.setArchived(Kind.MODEL, id, archive, reason, actor);
        return get(id);
    }

    /** Sets the name shown in the UI; blank clears it. The identity (name, version) never changes. Same value: no change. */
    @Transactional
    public ModelView rename(UUID id, RenameRequest r, UUID actor) {
        String name = TextRules.clean(r.displayName());
        String forbidden = TextRules.forbiddenCharacter(name);
        if (forbidden != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed",
                Map.of("displayName", forbidden));
        }
        var current = jdbc.queryForList("SELECT display_name FROM ai_models WHERE id = :id FOR UPDATE",
            new MapSqlParameterSource("id", id));
        if (current.isEmpty()) throw Kind.MODEL.notFound();
        String value = name.isEmpty() ? null : name;
        if (Objects.equals(current.getFirst().get("display_name"), value)) return get(id);
        jdbc.update("UPDATE ai_models SET display_name = :name, updated_at = now() WHERE id = :id",
            new MapSqlParameterSource("id", id).addValue("name", value));
        admin.record(Kind.MODEL, id, "RENAME", r.reason(), actor,
            transition(current.getFirst().get("display_name"), value));
        return get(id);
    }

    /**
     * Merges a model into another model of the same provider: reports count it as the target and lists hide it.
     * Merges are one level deep (a trigger enforces it too), so models already merged into this one move to the target
     * first (one MERGE row each). Merging into the current target again changes nothing.
     * {@code details.from}/{@code to} in the log are the model's {@code merged_into_id} before and after.
     */
    @Transactional
    public ModelView merge(UUID id, MergeRequest r, UUID actor) {
        if (id.equals(r.targetModelId())) {
            throw ApiException.badRequest("MODEL_MERGE_SELF", "A model cannot be merged into itself");
        }
        Map<UUID, Row> rows = lock(id, r.targetModelId());
        Row source = rows.get(id), target = rows.get(r.targetModelId());
        if (source == null) throw ApiException.notFound("MODEL_NOT_FOUND", "AI model not found");
        if (target == null) throw ApiException.notFound("MODEL_NOT_FOUND", "Target AI model not found");
        if (!source.providerId().equals(target.providerId())) {
            throw ApiException.conflict("MODEL_MERGE_CROSS_PROVIDER", "Models can only be merged within the same provider");
        }
        if (target.mergedIntoId() != null) {
            throw ApiException.conflict("MODEL_ALREADY_MERGED", "The target is already merged into another model; merge into that one");
        }
        if (target.id().equals(source.mergedIntoId())) return get(id);
        if (source.mergedIntoId() != null) {
            throw ApiException.conflict("MODEL_ALREADY_MERGED", "The model is already merged into another model; unmerge it first");
        }
        // Children first: the trigger rejects merging a model that still has merged children.
        for (UUID child : jdbc.queryForList("SELECT id FROM ai_models WHERE merged_into_id = :id ORDER BY id",
            new MapSqlParameterSource("id", id), UUID.class)) {
            setMergedInto(child, target.id());
            admin.record(Kind.MODEL, child, "MERGE", r.reason(), actor, transition(id, target.id()));
        }
        setMergedInto(id, target.id());
        admin.record(Kind.MODEL, id, "MERGE", r.reason(), actor, transition(null, target.id()));
        return get(id);
    }

    /** Makes a merged model a model of its own again (predictions stored meanwhile stay with the target). */
    @Transactional
    public ModelView unmerge(UUID id, String reason, UUID actor) {
        Row row = lock(id).get(id);
        if (row == null) throw Kind.MODEL.notFound();
        if (row.mergedIntoId() == null) return get(id);
        jdbc.update("UPDATE ai_models SET merged_into_id = NULL, updated_at = now() WHERE id = :id", new MapSqlParameterSource("id", id));
        admin.record(Kind.MODEL, id, "UNMERGE", reason, actor, transition(row.mergedIntoId(), null));
        return get(id);
    }

    private record Row(UUID id, UUID providerId, UUID mergedIntoId) {
    }

    /** Locks the rows in id order, so two merges that name the same pair cannot deadlock. */
    private Map<UUID, Row> lock(UUID... ids) {
        Map<UUID, Row> rows = new HashMap<>();
        jdbc.query("SELECT id, provider_id, merged_into_id FROM ai_models WHERE id IN (:ids) ORDER BY id FOR UPDATE",
            new MapSqlParameterSource("ids", List.of(ids)), rs -> {
                UUID id = rs.getObject("id", UUID.class);
                rows.put(id, new Row(id, rs.getObject("provider_id", UUID.class), rs.getObject("merged_into_id", UUID.class)));
            });
        return rows;
    }

    private void setMergedInto(UUID id, UUID target) {
        jdbc.update("UPDATE ai_models SET merged_into_id = :target, updated_at = now() WHERE id = :id",
            new MapSqlParameterSource("id", id).addValue("target", target));
    }

    /** Before and after of the changed field; HashMap because a side may be null. */
    private static Map<String, Object> transition(Object from, Object to) {
        Map<String, Object> m = new HashMap<>();
        m.put("from", from instanceof UUID u ? u.toString() : from);
        m.put("to", to instanceof UUID u ? u.toString() : to);
        return m;
    }

    private static ModelView view(ResultSet rs) throws SQLException {
        long wins = rs.getLong("wins"), losses = rs.getLong("losses");
        Timestamp last = rs.getTimestamp("last_prediction_at"), archived = rs.getTimestamp("archived_at");
        return new ModelView(rs.getObject("id", UUID.class), rs.getObject("provider_id", UUID.class),
            rs.getString("provider_name"), rs.getString("name"), rs.getString("display_name"), rs.getString("version"),
            rs.getString("description"), rs.getString("status"), rs.getLong("total_predictions"), rs.getLong("settled"),
            wins, losses, rs.getLong("pending"), Stats.winRate(wins, losses), last == null ? null : last.toInstant(),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
            archived == null ? null : archived.toInstant(), rs.getObject("merged_into_id", UUID.class));
    }
}
