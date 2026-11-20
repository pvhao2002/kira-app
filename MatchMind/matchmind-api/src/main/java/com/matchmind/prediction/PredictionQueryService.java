package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.match.Match;
import com.matchmind.match.MatchRepository;
import com.matchmind.model.AiModel;
import com.matchmind.model.AiModelRepository;
import com.matchmind.provider.Provider;
import com.matchmind.provider.ProviderRepository;
import com.matchmind.settlement.PickResult;
import com.matchmind.settlement.PickResultRepository;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Filters;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PredictionQueryService {
    private final NamedParameterJdbcTemplate jdbc;
    private final PredictionRepository predictions;
    private final PredictionOddsRepository odds;
    private final PredictionStatsRepository stats;
    private final PredictionSimulationRepository simulations;
    private final PredictionPickRepository picks;
    private final PredictionCorrectScoreRepository scores;
    private final PickResultRepository results;
    private final MatchRepository matches;
    private final AiModelRepository models;
    private final ProviderRepository providers;

    static final String FROM = """
        FROM predictions p
        JOIN matches m ON m.id = p.match_id
        """ + Sql.EFFECTIVE_MODEL_JOIN + """
        LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
        LEFT JOIN LATERAL (SELECT x.* FROM prediction_picks x WHERE x.prediction_id = p.id
                           ORDER BY x.pick_rank LIMIT 1) pk ON true
        LEFT JOIN prediction_odds o ON o.id = pk.odds_id
        LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
        """;

    /** Current result of every pick of the prediction (alias pc), mutually exclusive counts summing to pickCount. */
    private static final String PICK_COUNTS = """
        LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE yr.result = 'WIN') AS wins,
                                  count(*) FILTER (WHERE yr.result = 'HALF_WIN') AS half_wins,
                                  count(*) FILTER (WHERE yr.result = 'LOSS') AS losses,
                                  count(*) FILTER (WHERE yr.result = 'HALF_LOSS') AS half_losses,
                                  count(*) FILTER (WHERE yr.result IN ('PUSH','VOID')) AS push_void,
                                  count(*) FILTER (WHERE yr.result IS NULL OR yr.result = 'PENDING') AS pending
                           FROM prediction_picks y
                           LEFT JOIN prediction_pick_results yr ON yr.pick_id = y.id AND yr.is_current
                           WHERE y.prediction_id = p.id) pc ON true
        """;

    static final String COLUMNS = """
        SELECT p.id AS "id", p.predicted_at AS "predictedAt", p.prediction_type AS "predictionType",
               p.match_minute AS "matchMinute", p.current_home_score AS "currentHomeScore",
               p.current_away_score AS "currentAwayScore", p.external_event_id AS "eventId",
               m.id AS "matchId", m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam",
               m.start_time AS "startTime", m.status AS "matchStatus",
               m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
               am.id AS "modelId", %s AS "modelName", am.name AS "modelKey", am.version AS "modelVersion",
               cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore",
               cs.probability AS "correctScoreProbability",
               pk.id AS "topPickId", pk.market AS "topPickMarket", pk.pick AS "topPick", pk.probability AS "topPickProbability",
               o.line AS "topPickLine", o.line_display AS "topPickLineDisplay", o.odds_stage AS "topPickStage",
               %s AS "topPickPrice", COALESCE(r.result, 'PENDING') AS "settlementStatus",
               (SELECT count(*) FROM prediction_picks y WHERE y.prediction_id = p.id) AS "pickCount",
               pc.wins AS "pickWins", pc.half_wins AS "pickHalfWins", pc.losses AS "pickLosses",
               pc.half_losses AS "pickHalfLosses", pc.push_void AS "pickPushOrVoid", pc.pending AS "pickPending"
        """.formatted(Sql.MODEL_NAME, Sql.PRICE);

    private static final Map<String, String> SORT = Map.of(
        "predictedAt", "p.predicted_at", "league", "m.league", "model", Sql.MODEL_NAME, "type", "p.prediction_type",
        "minute", "p.match_minute", "probability", "pk.probability", "startTime", "m.start_time");

    @Transactional(readOnly = true)
    /**
     * {@code result} matches the top-ranked pick ({@code resultScope=TOP}, default) or any pick of the prediction
     * ({@code ANY}); with ANY and {@code market}, the same pick must have both.
     */
    public PageResponse<Map<String, Object>> list(Filters f, String resultScope, Integer page, Integer size, String sort) {
        int pg = Paging.page(page), sz = Paging.size(size);
        boolean any = scopeIsAny(resultScope);
        Sql.Where w = f.where(false);
        if (f.result() != null && !f.result().isBlank()) {
            String pending = "(%1$s.result IS NULL OR %1$s.result = 'PENDING')";
            if (!any) {
                if ("PENDING".equals(f.result())) w.and(pending.formatted("r"));
                else w.and("r.result = :topResult", "topResult", f.result());
            } else {
                boolean isPending = "PENDING".equals(f.result());
                String market = f.market() == null || f.market().isBlank() ? "" : " AND a.market = :market";
                String exists = "EXISTS (SELECT 1 FROM prediction_picks a LEFT JOIN prediction_pick_results ar"
                    + " ON ar.pick_id = a.id AND ar.is_current WHERE a.prediction_id = p.id" + market + " AND "
                    + (isPending ? pending.formatted("ar") : "ar.result = :anyResult") + ")";
                if (isPending) w.and(exists);
                else w.and(exists, "anyResult", f.result());
            }
        }
        long total = jdbc.queryForObject("SELECT count(*) " + FROM + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query(COLUMNS + FROM + PICK_COUNTS + w.sql() + " ORDER BY "
            + Paging.orderBy(sort, SORT, "p.predicted_at DESC") + ", p.id LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }

    private static boolean scopeIsAny(String resultScope) {
        if (resultScope == null || resultScope.isBlank() || "TOP".equals(resultScope)) return false;
        if ("ANY".equals(resultScope)) return true;
        throw ApiException.badRequest("INVALID_RESULT_SCOPE", "resultScope must be TOP or ANY");
    }

    public record OddsView(UUID id, String ref, String market, String stage, int snapshotOrder, BigDecimal line,
                           String lineDisplay, BigDecimal homeOdds, BigDecimal drawOdds, BigDecimal awayOdds,
                           BigDecimal overOdds, BigDecimal underOdds, String settlementBasis, Integer homeScoreAtCapture,
                           Integer awayScoreAtCapture, Integer homeCornersAtCapture, Integer awayCornersAtCapture,
                           Instant capturedAt, JsonNode extra) {
    }

    public record ResultView(UUID id, String result, Instant settledAt, String source, String calculationVersion,
                             boolean current, Instant supersededAt, String reason, JsonNode details) {
    }

    public record PickView(UUID id, int rank, String market, String pick, BigDecimal probability, UUID oddsId,
                           String oddsRef, BigDecimal price, BigDecimal line, String stage, String settlementStatus,
                           List<ResultView> results) {
    }

    public record ScoreView(int rank, int home, int away, BigDecimal probability) {
    }

    public record StatsView(BigDecimal possessionHome, BigDecimal possessionAway, Integer shotsHome, Integer shotsAway,
                            Integer shotsOnTargetHome, Integer shotsOnTargetAway, Integer shotsOffTargetHome,
                            Integer shotsOffTargetAway, Integer cornersHome, Integer cornersAway, Integer yellowCardsHome,
                            Integer yellowCardsAway, Integer redCardsHome, Integer redCardsAway, JsonNode extra) {
        static StatsView of(PredictionStats s) {
            return new StatsView(s.getPossessionHome(), s.getPossessionAway(), s.getShotsHome(), s.getShotsAway(),
                s.getShotsOnTargetHome(), s.getShotsOnTargetAway(), s.getShotsOffTargetHome(), s.getShotsOffTargetAway(),
                s.getCornersHome(), s.getCornersAway(), s.getYellowCardsHome(), s.getYellowCardsAway(), s.getRedCardsHome(),
                s.getRedCardsAway(), s.getExtra());
        }
    }

    public record SimulationView(String method, int simulationCount, Long randomSeed, BigDecimal expectedRemainingHomeGoals,
                                 BigDecimal expectedRemainingAwayGoals, BigDecimal expectedRemainingHomeCorners,
                                 BigDecimal expectedRemainingAwayCorners, String algorithmVersion, JsonNode parameters,
                                 JsonNode probabilities, JsonNode correctScoreDistribution) {
        static SimulationView of(PredictionSimulation s) {
            return new SimulationView(s.getMethod(), s.getSimulationCount(), s.getRandomSeed(),
                s.getExpectedRemainingHomeGoals(), s.getExpectedRemainingAwayGoals(), s.getExpectedRemainingHomeCorners(),
                s.getExpectedRemainingAwayCorners(), s.getAlgorithmVersion(), s.getParameters(), s.getProbabilities(),
                s.getCorrectScoreDistribution());
        }
    }

    public record Detail(UUID id, String eventId, String predictionType, Integer matchMinute, Integer currentHomeScore,
                         Integer currentAwayScore, Integer currentHomeCorners, Integer currentAwayCorners,
                         Instant predictedAt, Instant createdAt, Map<String, Object> match, Map<String, Object> model,
                         List<OddsView> odds, StatsView stats, SimulationView simulation,
                         List<PickView> picks, List<ScoreView> correctScores, JsonNode metadata, JsonNode payload) {
    }

    @Transactional(readOnly = true)
    public Detail detail(UUID id) {
        Prediction p = predictions.findById(id).orElseThrow(() -> ApiException.notFound("PREDICTION_NOT_FOUND", "Prediction not found"));
        Match m = matches.findById(p.getMatchId()).orElseThrow();
        AiModel am = models.findById(p.getAiModelId()).orElseThrow();
        String providerName = providers.findById(p.getProviderId()).map(Provider::getName).orElse(null);

        List<PredictionOdds> oddsRows = odds.findByPredictionIdOrderByMarketAscOddsStageAscSnapshotOrderAsc(id);
        Map<UUID, PredictionOdds> oddsById = oddsRows.stream().collect(Collectors.toMap(PredictionOdds::getId, Function.identity()));
        List<PredictionPick> pickRows = picks.findByPredictionIdOrderByPickRankAsc(id);
        Map<UUID, List<PickResult>> history = results.findByPickIdInOrderBySettledAtDesc(
            pickRows.stream().map(PredictionPick::getId).toList()).stream().collect(Collectors.groupingBy(PickResult::getPickId));

        List<PickView> pickViews = pickViews(pickRows, oddsById, history);
        Map<String, Object> match = matchView(m, providerName);
        Map<String, Object> model = Map.of("id", am.getId(), "name", am.getName(), "version", am.getVersion());

        return new Detail(p.getId(), p.getExternalEventId(), p.getPredictionType(), p.getMatchMinute(), p.getCurrentHomeScore(),
            p.getCurrentAwayScore(), p.getCurrentHomeCorners(), p.getCurrentAwayCorners(), p.getPredictedAt(), p.getCreatedAt(),
            match, model, oddsRows.stream().map(o -> new OddsView(o.getId(), o.getOddsRef(), o.getMarket(), o.getOddsStage(),
                o.getSnapshotOrder(), o.getLine(), o.getLineDisplay(), o.getHomeOdds(), o.getDrawOdds(), o.getAwayOdds(),
                o.getOverOdds(), o.getUnderOdds(), o.getSettlementBasis(), o.getHomeScoreAtCapture(), o.getAwayScoreAtCapture(),
                o.getHomeCornersAtCapture(), o.getAwayCornersAtCapture(), o.getCapturedAt(), o.getExtra())).toList(),
            stats.findByPredictionId(id).map(StatsView::of).orElse(null),
            simulations.findByPredictionId(id).map(SimulationView::of).orElse(null), pickViews,
            scores.findByPredictionIdOrderByScoreRankAsc(id).stream()
                .map(s -> new ScoreView(s.getScoreRank(), s.getHomeScore(), s.getAwayScore(), s.getProbability())).toList(),
            p.getMetadata(), p.getPayload());
    }

    private static List<PickView> pickViews(List<PredictionPick> pickRows, Map<UUID, PredictionOdds> oddsById,
                                            Map<UUID, List<PickResult>> history) {
        return pickRows.stream().map(pk -> {
            PredictionOdds o = oddsById.get(pk.getOddsId());
            List<ResultView> rs = history.getOrDefault(pk.getId(), List.of()).stream().map(r -> new ResultView(r.getId(),
                r.getResult(), r.getSettledAt(), r.getSource(), r.getCalculationVersion(), r.isCurrent(), r.getSupersededAt(),
                r.getReason(), r.getDetails())).toList();
            String status = rs.stream().filter(ResultView::current).map(ResultView::result).findFirst().orElse("PENDING");
            return new PickView(pk.getId(), pk.getPickRank(), pk.getMarket(), pk.getPick(), pk.getProbability(), o.getId(),
                o.getOddsRef(), o.priceOf(pk.getPick()), o.getLine(), o.getOddsStage(), status, rs);
        }).toList();
    }

    private static Map<String, Object> matchView(Match m, String providerName) {
        Map<String, Object> match = new LinkedHashMap<>();
        match.put("id", m.getId());
        match.put("externalMatchId", m.getExternalMatchId());
        match.put("providerId", m.getProviderId());
        match.put("providerName", providerName);
        match.put("league", m.getLeague());
        match.put("homeTeam", m.getHomeTeam());
        match.put("awayTeam", m.getAwayTeam());
        match.put("startTime", m.getStartTime());
        match.putAll(m.resultSnapshot());
        return match;
    }
}
