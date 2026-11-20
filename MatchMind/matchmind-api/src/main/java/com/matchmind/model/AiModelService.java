package com.matchmind.model;

import com.matchmind.shared.ApiException;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiModelService {
    private final NamedParameterJdbcTemplate jdbc;

    /**
     * {@code name} is the provider-supplied key; {@code displayName} is what to show (the admin's rename, else the name).
     * Stats cover the model and every model merged into it, and leave out predictions on archived matches.
     */
    public record ModelView(UUID id, UUID providerId, String providerName, String name, String displayName, String version,
                            String description, String status, long totalPredictions, long settledPicks, long wins,
                            long losses, long pendingPicks, BigDecimal winRate, Instant lastPredictionAt,
                            Instant createdAt, Instant updatedAt, Instant archivedAt, UUID mergedIntoId) {
    }

    /** The model and the models merged into it (alias m = the surviving model). */
    private static final String FAMILY = "(SELECT c.id FROM ai_models c WHERE c.id = m.id OR c.merged_into_id = m.id)";
    private static final String MATCH_ACTIVE =
        " AND NOT EXISTS (SELECT 1 FROM matches mt WHERE mt.id = pr.match_id AND mt.archived_at IS NOT NULL)";

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
        """.formatted(FAMILY, MATCH_ACTIVE, Stats.SETTLED, Stats.WINS, Stats.LOSSES, Stats.PENDING, Stats.CURRENT_RESULT_JOIN);

    /** Hides merged and archived models (and those of an archived provider) unless {@code includeArchived}. */
    @Transactional(readOnly = true)
    public List<ModelView> list(UUID providerId, Boolean includeArchived) {
        Sql.Where w = new Sql.Where().and("m.provider_id = :providerId", "providerId", providerId);
        if (!Boolean.TRUE.equals(includeArchived)) {
            w.and("m.merged_into_id IS NULL AND m.archived_at IS NULL AND p.archived_at IS NULL");
        }
        return jdbc.query(SQL + w.sql() + " ORDER BY COALESCE(m.display_name, m.name), m.version", w.params, (rs, i) -> view(rs));
    }

    @Transactional(readOnly = true)
    public ModelView get(UUID id) {
        return jdbc.query(SQL + " WHERE m.id = :id", new MapSqlParameterSource("id", id), (rs, i) -> view(rs))
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("MODEL_NOT_FOUND", "AI model not found"));
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
