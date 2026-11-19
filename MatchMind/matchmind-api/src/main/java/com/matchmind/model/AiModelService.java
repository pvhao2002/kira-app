package com.matchmind.model;

import com.matchmind.shared.ApiException;
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

    public record ModelView(UUID id, UUID providerId, String providerName, String name, String version,
                            String description, String status, long totalPredictions, long settledPicks, long wins,
                            long losses, long pendingPicks, BigDecimal winRate, Instant lastPredictionAt,
                            Instant createdAt, Instant updatedAt) {
    }

    private static final String SQL = """
        SELECT m.id, m.provider_id, p.name AS provider_name, m.name, m.version, m.description, m.status,
               m.created_at, m.updated_at,
               (SELECT count(*) FROM predictions pr WHERE pr.ai_model_id = m.id) AS total_predictions,
               (SELECT max(pr.predicted_at) FROM predictions pr WHERE pr.ai_model_id = m.id) AS last_prediction_at,
               s.settled, s.wins, s.losses, s.pending
        FROM ai_models m
        JOIN providers p ON p.id = m.provider_id
        LEFT JOIN LATERAL (
            SELECT %s AS settled, %s AS wins, %s AS losses, %s AS pending
            FROM predictions pr JOIN prediction_picks pk ON pk.prediction_id = pr.id %s
            WHERE pr.ai_model_id = m.id) s ON true
        """.formatted(Stats.SETTLED, Stats.WINS, Stats.LOSSES, Stats.PENDING, Stats.CURRENT_RESULT_JOIN);

    @Transactional(readOnly = true)
    public List<ModelView> list(UUID providerId) {
        MapSqlParameterSource p = new MapSqlParameterSource("providerId", providerId);
        String where = providerId == null ? "" : " WHERE m.provider_id = :providerId";
        return jdbc.query(SQL + where + " ORDER BY m.name, m.version", p, (rs, i) -> view(rs));
    }

    @Transactional(readOnly = true)
    public ModelView get(UUID id) {
        return jdbc.query(SQL + " WHERE m.id = :id", new MapSqlParameterSource("id", id), (rs, i) -> view(rs))
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("MODEL_NOT_FOUND", "AI model not found"));
    }

    private static ModelView view(ResultSet rs) throws SQLException {
        long wins = rs.getLong("wins"), losses = rs.getLong("losses");
        Timestamp last = rs.getTimestamp("last_prediction_at");
        return new ModelView(rs.getObject("id", UUID.class), rs.getObject("provider_id", UUID.class),
            rs.getString("provider_name"), rs.getString("name"), rs.getString("version"), rs.getString("description"),
            rs.getString("status"), rs.getLong("total_predictions"), rs.getLong("settled"), wins, losses,
            rs.getLong("pending"), Stats.winRate(wins, losses), last == null ? null : last.toInstant(),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }
}
