package com.matchmind.match;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.CacheConfig;
import com.matchmind.shared.Filters;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MatchQueryService {
    private final NamedParameterJdbcTemplate jdbc;
    private final MatchResultHistoryRepository history;

    /**
     * Kick-off was more than 3 hours ago and the match is still SCHEDULED or LIVE: a result is due but missing.
     * ponytail: fixed 3 h covers 90' + extra time + breaks; make it configurable if non-football sports arrive.
     */
    public static final String OVERDUE = "(m.status IN ('SCHEDULED','LIVE') AND m.start_time < now() - interval '3 hours')";

    private static final String COLUMNS = """
        SELECT m.id AS "id", m.external_match_id AS "externalMatchId", m.provider_id AS "providerId",
               pv.name AS "providerName", m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam",
               m.start_time AS "startTime", m.status AS "status",
               m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
               m.final_home_corners AS "finalHomeCorners", m.final_away_corners AS "finalAwayCorners",
               m.ht_home_score AS "htHomeScore", m.ht_away_score AS "htAwayScore",
               m.ht_home_corners AS "htHomeCorners", m.ht_away_corners AS "htAwayCorners",
               m.result_updated_at AS "resultUpdatedAt", m.created_at AS "createdAt", m.updated_at AS "updatedAt",
               %s AS "overdue",
               (SELECT count(*) FROM predictions p WHERE p.match_id = m.id) AS "predictionCount",
               (SELECT count(DISTINCT COALESCE(a.merged_into_id, a.id)) FROM predictions p
                JOIN ai_models a ON a.id = p.ai_model_id WHERE p.match_id = m.id) AS "modelCount"
        FROM matches m JOIN providers pv ON pv.id = m.provider_id
        """.formatted(OVERDUE);

    private static final Map<String, String> SORT = Map.of("startTime", "m.start_time", "league", "m.league",
        "homeTeam", "m.home_team", "awayTeam", "m.away_team", "status", "m.status",
        "predictionCount", "\"predictionCount\"");

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(String search, String status, String league, UUID providerId,
                                                  Instant from, Instant to, Boolean overdue, Boolean includeArchived,
                                                  Integer page, Integer size, String sort) {
        int pg = Paging.page(page), sz = Paging.size(size);
        if (status != null && !status.isBlank() && !List.of("SCHEDULED", "LIVE", "FINISHED", "CANCELLED", "POSTPONED").contains(status)) {
            throw ApiException.badRequest("INVALID_STATUS", "Unknown match status");
        }
        Filters.checkRange(from, to);
        Sql.Where w = new Sql.Where()
            .and(Filters.SEARCH, "q", search == null || search.isBlank() ? null : Paging.contains(search))
            .and("m.status = :status", "status", status)
            .and(Filters.LEAGUE, "league", league)
            .and("m.provider_id = :providerId", "providerId", providerId)
            .and("m.start_time >= :from", "from", from)
            .and("m.start_time < :to", "to", to);
        if (Boolean.TRUE.equals(overdue)) w.and(OVERDUE);
        Filters.activeMatches(w, includeArchived, providerId != null);
        long total = jdbc.queryForObject("SELECT count(*) FROM matches m" + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query(COLUMNS + w.sql() + " ORDER BY "
            + Paging.orderBy(sort, SORT, "m.start_time DESC") + ", m.id LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }

    /** Leagues of the visible matches; cached, so a later archive must evict {@link CacheConfig#LEAGUES}. */
    @Cacheable(CacheConfig.LEAGUES)
    @Transactional(readOnly = true)
    public List<String> leagues() {
        Sql.Where w = new Sql.Where();
        Filters.activeMatches(w, false, false);
        return jdbc.queryForList("SELECT DISTINCT league FROM matches m" + w.sql() + " ORDER BY league", w.params, String.class);
    }

    /** Every league, archived matches included (uncached: only an admin looking at archived data asks). */
    @Transactional(readOnly = true)
    public List<String> leaguesIncludingArchived() {
        return jdbc.queryForList("SELECT DISTINCT league FROM matches ORDER BY league", Map.of(), String.class);
    }

    public record HistoryView(UUID id, JsonNode previousResult, JsonNode newResult, String changeSource, Instant changedAt) {
    }

    /** Match + result audit trail + per-model comparison + latest available live statistics. */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(UUID id) {
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        Map<String, Object> match = jdbc.query(COLUMNS + " WHERE m.id = :id", p, Sql.ROW).stream().findFirst()
            .orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "Match not found"));

        List<Map<String, Object>> models = jdbc.query("""
            SELECT am.id AS "modelId", %1$s AS "modelName", am.name AS "modelKey", am.version AS "modelVersion",
                   count(DISTINCT p.id) AS "predictions", count(pk.id) AS "picks",
                   %2$s AS "wins", %3$s AS "losses", %4$s AS "pushOrVoid", %5$s AS "pending",
                   max(p.predicted_at) AS "lastPredictedAt"
            FROM predictions p %6$s
            LEFT JOIN prediction_picks pk ON pk.prediction_id = p.id %7$s
            WHERE p.match_id = :id
            GROUP BY am.id, am.display_name, am.name, am.version ORDER BY %1$s
            """.formatted(Sql.MODEL_NAME, Stats.WINS, Stats.LOSSES, Stats.PUSH_VOID, Stats.PENDING, Sql.EFFECTIVE_MODEL_JOIN,
            Stats.CURRENT_RESULT_JOIN), p, Sql.ROW);
        models.forEach(row -> row.put("winRate", Stats.winRate(((Number) row.get("wins")).longValue(),
            ((Number) row.get("losses")).longValue())));

        List<Map<String, Object>> latest = jdbc.query("""
            SELECT DISTINCT ON (am.id) p.id AS "predictionId", am.id AS "modelId", p.predicted_at AS "predictedAt",
                   p.prediction_type AS "predictionType", p.match_minute AS "matchMinute",
                   cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore", cs.probability AS "correctScoreProbability",
                   pk.market AS "topPickMarket", pk.pick AS "topPick", pk.probability AS "topPickProbability", o.line AS "topPickLine",
                   %s AS "topPickPrice", COALESCE(r.result, 'PENDING') AS "topPickResult"
            FROM predictions p %s
            LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
            LEFT JOIN LATERAL (SELECT x.* FROM prediction_picks x WHERE x.prediction_id = p.id ORDER BY x.pick_rank LIMIT 1) pk ON true
            LEFT JOIN prediction_odds o ON o.id = pk.odds_id
            LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
            WHERE p.match_id = :id
            ORDER BY am.id, p.predicted_at DESC
            """.formatted(Sql.PRICE, Sql.EFFECTIVE_MODEL_JOIN), p, Sql.ROW);
        Map<Object, Map<String, Object>> latestByModel = new LinkedHashMap<>();
        latest.forEach(row -> latestByModel.put(row.get("modelId"), row));
        models.forEach(row -> row.put("latest", latestByModel.get(row.get("modelId"))));

        List<Map<String, Object>> stats = jdbc.query("""
            SELECT p.id AS "predictionId", p.match_minute AS "matchMinute", p.predicted_at AS "predictedAt",
                   s.possession_home AS "possessionHome", s.possession_away AS "possessionAway",
                   s.shots_home AS "shotsHome", s.shots_away AS "shotsAway",
                   s.shots_on_target_home AS "shotsOnTargetHome", s.shots_on_target_away AS "shotsOnTargetAway",
                   s.shots_off_target_home AS "shotsOffTargetHome", s.shots_off_target_away AS "shotsOffTargetAway",
                   s.corners_home AS "cornersHome", s.corners_away AS "cornersAway",
                   s.yellow_cards_home AS "yellowCardsHome", s.yellow_cards_away AS "yellowCardsAway",
                   s.red_cards_home AS "redCardsHome", s.red_cards_away AS "redCardsAway"
            FROM prediction_stats s JOIN predictions p ON p.id = s.prediction_id
            WHERE p.match_id = :id ORDER BY p.predicted_at DESC LIMIT 1
            """, p, Sql.ROW);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("match", match);
        out.put("models", models);
        out.put("latestStats", stats.isEmpty() ? null : stats.getFirst());
        out.put("resultHistory", history.findByMatchIdOrderByChangedAtDesc(id).stream()
            .map(h -> new HistoryView(h.getId(), h.getPreviousResult(), h.getNewResult(), h.getChangeSource(), h.getChangedAt()))
            .toList());
        return out;
    }
}
