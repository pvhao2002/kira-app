package com.matchmind.shared;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Query-string filters shared by predictions, dashboard and reports. Bound from request params
 * (?from=2026-11-01T00:00:00Z&to=...&league=...&modelId=...&type=LIVE&market=AH). {@code to} is exclusive.
 * Expects SQL aliases p (predictions), m (matches) and, for pick-level queries, pk (prediction_picks).
 * Archived providers, models and matches (V24) are left out unless {@code includeArchived=true}; naming one explicitly
 * ({@code modelId}, {@code providerId}, {@code matchId}) shows only that one, never the other archived rows.
 */
public record Filters(Instant from, Instant to, String league, UUID modelId, UUID providerId, String type,
                      String market, UUID matchId, String search, String result,
                      Boolean includeArchived) {
    private static final Set<String> TYPES = Set.of("PRE_MATCH", "LIVE");
    /** Every supported market, in display order. */
    public static final List<String> MARKETS = List.of("1X2", "AH", "OU", "CORNER_AH", "CORNER_OU");
    private static final Set<String> RESULTS = Set.of("WIN", "LOSS", "HALF_WIN", "HALF_LOSS", "PUSH", "VOID", "PENDING");

    /**
     * Free-text search on match alias m, bound as :q ({@link Paging#contains}). mm_fold (V22) ignores case, accents and
     * Unicode normal form, so "atletico" finds "Atlético" and "munchen" finds "München".
     */
    public static final String SEARCH = "(mm_fold(m.home_team) LIKE mm_fold(:q) OR mm_fold(m.away_team) LIKE mm_fold(:q)"
        + " OR mm_fold(m.league) LIKE mm_fold(:q) OR mm_fold(m.external_match_id) LIKE mm_fold(:q))";
    /** League filter on match alias m, bound as :league: exact name after trimming and folding case and accents. */
    public static final String LEAGUE = "mm_fold(btrim(m.league)) = mm_fold(btrim(:league))";

    /** Match alias m, left out when archived or when its provider is archived (the provider is skipped when named). */
    public static void activeMatches(Sql.Where w, Boolean includeArchived, boolean providerNamed) {
        if (Boolean.TRUE.equals(includeArchived)) return;
        w.and("m.archived_at IS NULL");
        if (!providerNamed) w.and(PROVIDER_ACTIVE.formatted("m.provider_id"));
    }

    private static final String PROVIDER_ACTIVE =
        "NOT EXISTS (SELECT 1 FROM providers x WHERE x.id = %s AND x.archived_at IS NOT NULL)";
    /** The model of prediction alias p, or the model it was merged into, is archived. */
    private static final String MODEL_ACTIVE = "NOT EXISTS (SELECT 1 FROM ai_models x WHERE x.archived_at IS NOT NULL AND x.id IN"
        + " (p.ai_model_id, (SELECT y.merged_into_id FROM ai_models y WHERE y.id = p.ai_model_id)))";

    /** Rejects {@code from >= to} with a field error; either end alone is an open range. */
    public static void checkRange(Instant from, Instant to) {
        if (from != null && to != null && !from.isBefore(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "'from' must be before 'to'",
                Map.of("from", "must be before 'to'"));
        }
    }

    public Sql.Where where(boolean pickLevel) {
        if (type != null && !type.isBlank() && !TYPES.contains(type)) throw ApiException.badRequest("INVALID_TYPE", "Unknown prediction type");
        if (market != null && !market.isBlank() && !MARKETS.contains(market)) throw ApiException.badRequest("INVALID_MARKET", "Unknown market");
        if (result != null && !result.isBlank() && !RESULTS.contains(result)) throw ApiException.badRequest("INVALID_RESULT", "Unknown result");
        checkRange(from, to);
        Sql.Where w = new Sql.Where()
            .and("p.predicted_at >= :from", "from", from)
            .and("p.predicted_at < :to", "to", to)
            .and(LEAGUE, "league", league)
            .and("p.ai_model_id IN (SELECT id FROM ai_models WHERE id = :modelId OR merged_into_id = :modelId)", "modelId", modelId)
            .and("p.provider_id = :providerId", "providerId", providerId)
            .and("p.prediction_type = :type", "type", type)
            .and("p.match_id = :matchId", "matchId", matchId)
            .and(SEARCH, "q", search == null || search.isBlank() ? null : Paging.contains(search));
        if (!Boolean.TRUE.equals(includeArchived)) {
            if (matchId == null) w.and("m.archived_at IS NULL");
            if (modelId == null) w.and(MODEL_ACTIVE);
            if (providerId == null) w.and(PROVIDER_ACTIVE.formatted("p.provider_id"));
        }
        if (pickLevel) {
            w.and("pk.market = :market", "market", market);
            if ("PENDING".equals(result)) w.and("(r.result IS NULL OR r.result = 'PENDING')");
            else w.and("r.result = :result", "result", result);
        } else {
            w.and("EXISTS (SELECT 1 FROM prediction_picks x WHERE x.prediction_id = p.id AND x.market = :market)", "market", market);
        }
        return w;
    }
}
