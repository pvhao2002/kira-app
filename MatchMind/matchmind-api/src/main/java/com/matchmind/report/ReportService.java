package com.matchmind.report;

import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Filters;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** All report figures are aggregated in PostgreSQL; the browser only ever receives one page or one summary. */
@Service
@RequiredArgsConstructor
public class ReportService {
    public static final int EXPORT_LIMIT = 50_000;
    private static final int MAX_COMPARISON_PAGE_SIZE = 50;
    private static final int DEFAULT_MIN_MODELS = 2;
    private static final int MAX_MIN_MODELS = 20;
    /** Count columns of {@link #AGG}; a market without picks reports zero for each. */
    private static final List<String> COUNT_COLUMNS =
        List.of("picks", "settled", "wins", "losses", "pushOrVoid", "pending", "halfWins", "halfLosses");
    private final NamedParameterJdbcTemplate jdbc;

    /** Pick-level base: every pick with its prediction, match, model, odds snapshot and current settlement. */
    static final String PICKS_FROM = """
        FROM prediction_picks pk
        JOIN predictions p ON p.id = pk.prediction_id
        JOIN matches m ON m.id = p.match_id
        JOIN ai_models am ON am.id = p.ai_model_id
        JOIN prediction_odds o ON o.id = pk.odds_id
        """ + Stats.CURRENT_RESULT_JOIN;

    static final String AGG = """
        count(pk.id) AS "picks", %s AS "settled", %s AS "wins", %s AS "losses", %s AS "pushOrVoid", %s AS "pending",
        count(*) FILTER (WHERE r.result = 'HALF_WIN') AS "halfWins", count(*) FILTER (WHERE r.result = 'HALF_LOSS') AS "halfLosses",
        round(avg(pk.probability), 4) AS "avgProbability"
        """.formatted(Stats.SETTLED, Stats.WINS, Stats.LOSSES, Stats.PUSH_VOID, Stats.PENDING);

    static void addWinRate(Map<String, Object> row) {
        row.put("winRate", Stats.winRate(num(row.get("wins")), num(row.get("losses"))));
    }

    static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    // ------------------------------------------------------------------ Report 1: AI model performance
    @Transactional(readOnly = true)
    public List<Map<String, Object>> modelPerformance(Filters f) {
        Sql.Where pickWhere = f.where(true);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT am.id AS "modelId", am.name AS "modelName", am.version AS "modelVersion", pv.name AS "providerName",
                   count(DISTINCT p.id) AS "predictions", %s
            %s JOIN providers pv ON pv.id = am.provider_id
            %s GROUP BY am.id, am.name, am.version, pv.name ORDER BY am.name, am.version
            """.formatted(AGG, PICKS_FROM, pickWhere.sql()), pickWhere.params, Sql.ROW);

        Sql.Where predWhere = f.where(false);
        Map<Object, Map<String, Object>> cs = new LinkedHashMap<>();
        jdbc.query("""
            SELECT p.ai_model_id AS "modelId",
                   count(*) FILTER (WHERE m.status = 'FINISHED') AS "correctScoreEvaluated",
                   count(*) FILTER (WHERE m.status = 'FINISHED' AND cs.home_score = m.final_home_score
                                    AND cs.away_score = m.final_away_score) AS "correctScoreHits"
            FROM predictions p JOIN matches m ON m.id = p.match_id
            JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
            %s GROUP BY p.ai_model_id
            """.formatted(predWhere.sql()), predWhere.params, Sql.ROW).forEach(r -> cs.put(r.get("modelId"), r));
        for (Map<String, Object> row : rows) {
            addWinRate(row);
            Map<String, Object> c = cs.getOrDefault(row.get("modelId"), Map.of());
            long evaluated = num(c.get("correctScoreEvaluated")), hits = num(c.get("correctScoreHits"));
            row.put("correctScoreEvaluated", evaluated);
            row.put("correctScoreHits", hits);
            row.put("correctScoreAccuracy", Stats.ratio(hits, evaluated));
        }
        return rows;
    }

    /** Drill-down of one model (or all models when modelId is null) by market, league, prediction type or odds stage. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> breakdown(Filters f, String by) {
        String key = switch (by == null ? "market" : by) {
            case "market" -> "pk.market";
            case "league" -> "m.league";
            case "type" -> "p.prediction_type";
            case "stage" -> "o.odds_stage";
            case "model" -> "am.name || ' ' || am.version";
            default -> throw ApiException.badRequest("INVALID_GROUP", "by must be market, league, type, stage or model");
        };
        Sql.Where w = f.where(true);
        List<Map<String, Object>> rows = jdbc.query("SELECT " + key + " AS \"key\", " + AGG + PICKS_FROM + w.sql()
            + " GROUP BY 1 ORDER BY count(pk.id) DESC, 1", w.params, Sql.ROW);
        rows.forEach(ReportService::addWinRate);
        return rows;
    }

    // ------------------------------------------------------------------ Report 2: prediction history (pick level)
    static final String HISTORY_COLUMNS = """
        SELECT pk.id AS "pickId", p.id AS "predictionId", p.predicted_at AS "predictedAt", m.id AS "matchId",
               m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam", m.start_time AS "startTime",
               m.status AS "matchStatus", am.id AS "modelId", am.name AS "modelName", am.version AS "modelVersion",
               p.prediction_type AS "predictionType", p.match_minute AS "matchMinute",
               p.current_home_score AS "currentHomeScore", p.current_away_score AS "currentAwayScore",
               cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore", cs.probability AS "correctScoreProbability",
               m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
               m.final_home_corners AS "finalHomeCorners", m.final_away_corners AS "finalAwayCorners",
               pk.market AS "market", pk.pick AS "pick", pk.pick_rank AS "pickRank", pk.probability AS "probability",
               o.odds_stage AS "oddsStage", o.line AS "line", o.line_display AS "lineDisplay", %s AS "price",
               o.settlement_basis AS "settlementBasis", o.home_score_at_capture AS "homeScoreAtCapture",
               o.away_score_at_capture AS "awayScoreAtCapture",
               COALESCE(r.result, 'PENDING') AS "result", r.settled_at AS "settledAt", r.source AS "settlementSource"
        """.formatted(Sql.PRICE);

    static final String HISTORY_FROM = PICKS_FROM
        + " LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1 ";

    private static final Map<String, String> HISTORY_SORT = Map.ofEntries(
        Map.entry("predictedAt", "p.predicted_at"), Map.entry("league", "m.league"), Map.entry("model", "am.name"),
        Map.entry("market", "pk.market"), Map.entry("probability", "pk.probability"), Map.entry("price", "\"price\""),
        Map.entry("line", "o.line"), Map.entry("result", "\"result\""), Map.entry("minute", "p.match_minute"),
        Map.entry("type", "p.prediction_type"), Map.entry("homeTeam", "m.home_team"));

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> predictionHistory(Filters f, Integer page, Integer size, String sort) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = f.where(true);
        long total = countPicks(w);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query(HISTORY_COLUMNS + HISTORY_FROM + w.sql() + historyOrder(sort)
            + " LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }

    private long countPicks(Sql.Where w) {
        return jdbc.queryForObject("SELECT count(*) " + PICKS_FROM + w.sql(), w.params, Long.class);
    }

    /** Same order for the page and the export; pick rank and id make it total, so paging never skips rows. */
    private static String historyOrder(String sort) {
        return " ORDER BY " + Paging.orderBy(sort, HISTORY_SORT, "p.predicted_at DESC") + ", pk.pick_rank, pk.id";
    }

    public static final List<String> EXPORT_COLUMNS = List.of("predictedAt", "league", "homeTeam", "awayTeam", "modelName",
        "modelVersion", "predictionType", "matchMinute", "currentHomeScore", "currentAwayScore", "predictedHomeScore",
        "predictedAwayScore", "finalHomeScore", "finalAwayScore", "market", "oddsStage", "pick", "pickRank", "lineDisplay",
        "line", "price", "probability", "settlementBasis", "result", "settledAt");

    @Transactional(readOnly = true)
    public List<List<Object>> predictionHistoryExport(Filters f, String sort) {
        Sql.Where w = f.where(true);
        long total = countPicks(w);
        if (total > EXPORT_LIMIT) {
            throw ApiException.badRequest("EXPORT_TOO_LARGE", "Export is limited to " + EXPORT_LIMIT
                + " rows; narrow the filters (current: " + total + ")");
        }
        List<List<Object>> out = new ArrayList<>();
        jdbc.query(HISTORY_COLUMNS + HISTORY_FROM + w.sql() + historyOrder(sort), w.params, Sql.ROW)
            .forEach(row -> out.add(EXPORT_COLUMNS.stream().map(c -> {
                Object v = row.get(c);
                return v instanceof Instant i ? (Object) i.toString() : v;
            }).toList()));
        return out;
    }

    // ------------------------------------------------------------------ Report 3: market performance
    @Transactional(readOnly = true)
    public List<Map<String, Object>> marketPerformance(Filters f) {
        Sql.Where w = f.where(true);
        Map<String, Map<String, Object>> byMarket = new LinkedHashMap<>();
        for (String market : Filters.MARKETS) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("market", market);
            COUNT_COLUMNS.forEach(k -> empty.put(k, 0L));
            empty.put("avgProbability", null);
            byMarket.put(market, empty);
        }
        jdbc.query("SELECT pk.market AS \"market\", " + AGG + PICKS_FROM + w.sql() + " GROUP BY pk.market", w.params, Sql.ROW)
            .forEach(row -> byMarket.put((String) row.get("market"), row));
        List<Map<String, Object>> rows = new ArrayList<>(byMarket.values());
        rows.forEach(ReportService::addWinRate);
        return rows;
    }

    // ------------------------------------------------------------------ Report 4: model comparison on the same matches
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> modelComparison(Filters f, Integer minModels, Integer page, Integer size) {
        int pg = Paging.page(page), sz = Math.min(Paging.size(size), MAX_COMPARISON_PAGE_SIZE);
        int min = minModels == null ? DEFAULT_MIN_MODELS : Math.max(1, Math.min(minModels, MAX_MIN_MODELS));
        Sql.Where w = f.where(false);
        w.params.addValue("minModels", min);
        String matchIds = "SELECT p.match_id FROM predictions p JOIN matches m ON m.id = p.match_id " + w.sql()
            + " GROUP BY p.match_id HAVING count(DISTINCT p.ai_model_id) >= :minModels";
        long total = jdbc.queryForObject("SELECT count(*) FROM (" + matchIds + ") x", w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> matches = jdbc.query("""
            SELECT m.id AS "matchId", m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam",
                   m.start_time AS "startTime", m.status AS "status", m.final_home_score AS "finalHomeScore",
                   m.final_away_score AS "finalAwayScore", m.final_home_corners AS "finalHomeCorners",
                   m.final_away_corners AS "finalAwayCorners"
            FROM matches m WHERE m.id IN (%s) ORDER BY m.start_time DESC, m.id LIMIT :limit OFFSET :offset
            """.formatted(matchIds), w.params, Sql.ROW);
        if (matches.isEmpty()) return Paging.response(matches, pg, sz, total);

        Sql.Where inner = f.where(false);
        inner.params.addValue("ids", matches.stream().map(r -> r.get("matchId")).toList());
        List<Map<String, Object>> entries = jdbc.query("""
            SELECT DISTINCT ON (p.match_id, p.ai_model_id)
                   p.match_id AS "matchId", p.id AS "predictionId", am.id AS "modelId", am.name AS "modelName",
                   am.version AS "modelVersion", p.predicted_at AS "predictedAt", p.prediction_type AS "predictionType",
                   p.match_minute AS "matchMinute", cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore",
                   cs.probability AS "correctScoreProbability",
                   (cs.home_score = m.final_home_score AND cs.away_score = m.final_away_score) AS "correctScoreHit",
                   pk.market AS "market", pk.pick AS "pick", pk.probability AS "probability", o.line AS "line",
                   o.line_display AS "lineDisplay", %s AS "price", COALESCE(r.result, 'PENDING') AS "result",
                   (SELECT count(*) FROM predictions q WHERE q.match_id = p.match_id AND q.ai_model_id = p.ai_model_id) AS "predictionCount"
            FROM predictions p JOIN matches m ON m.id = p.match_id JOIN ai_models am ON am.id = p.ai_model_id
            LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
            LEFT JOIN LATERAL (SELECT x.* FROM prediction_picks x WHERE x.prediction_id = p.id ORDER BY x.pick_rank LIMIT 1) pk ON true
            LEFT JOIN prediction_odds o ON o.id = pk.odds_id
            LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
            WHERE p.match_id IN (:ids) %s
            ORDER BY p.match_id, p.ai_model_id, p.predicted_at DESC
            """.formatted(Sql.PRICE, inner.andSql()), inner.params, Sql.ROW);
        Map<Object, List<Map<String, Object>>> byMatch = new LinkedHashMap<>();
        entries.forEach(e -> byMatch.computeIfAbsent(e.get("matchId"), k -> new ArrayList<>()).add(e));
        matches.forEach(mt -> mt.put("models", byMatch.getOrDefault(mt.get("matchId"), List.of())));
        return Paging.response(matches, pg, sz, total);
    }

    // ------------------------------------------------------------------ Report 5: Monte Carlo analysis
    static final String MC_FROM = """
        FROM predictions p
        JOIN prediction_simulations s ON s.prediction_id = p.id
        JOIN matches m ON m.id = p.match_id
        JOIN ai_models am ON am.id = p.ai_model_id
        LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
        """;

    @Transactional(readOnly = true)
    public Map<String, Object> monteCarlo(Filters f, Integer page, Integer size) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = f.where(false);
        // Remaining goals actually scored after the prediction = final - score at prediction time (0-0 pre-match).
        String actualRemaining = "(m.final_home_score + m.final_away_score - COALESCE(p.current_home_score, 0) - COALESCE(p.current_away_score, 0))";
        String expectedRemaining = "(s.expected_remaining_home_goals + s.expected_remaining_away_goals)";
        Map<String, Object> summary = jdbc.query("""
            SELECT count(*) AS "simulatedPredictions", round(avg(s.simulation_count)) AS "avgSimulationCount",
                   round(avg(%2$s), 4) AS "avgExpectedRemainingGoals",
                   count(*) FILTER (WHERE m.status = 'FINISHED') AS "finishedPredictions",
                   round(avg(%1$s) FILTER (WHERE m.status = 'FINISHED'), 4) AS "avgActualRemainingGoals",
                   round(avg(abs(%2$s - %1$s)) FILTER (WHERE m.status = 'FINISHED'), 4) AS "meanAbsGoalError",
                   count(*) FILTER (WHERE m.status = 'FINISHED' AND cs.home_score = m.final_home_score
                                    AND cs.away_score = m.final_away_score) AS "correctScoreHits"
            %3$s %4$s
            """.formatted(actualRemaining, expectedRemaining, MC_FROM, w.sql()), w.params, Sql.ROW).getFirst();
        summary.put("correctScoreAccuracy", Stats.ratio(num(summary.get("correctScoreHits")), num(summary.get("finishedPredictions"))));

        long total = num(summary.get("simulatedPredictions"));
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT p.id AS "predictionId", p.predicted_at AS "predictedAt", m.id AS "matchId", m.league AS "league",
                   m.home_team AS "homeTeam", m.away_team AS "awayTeam", m.status AS "matchStatus",
                   am.name AS "modelName", am.version AS "modelVersion", p.prediction_type AS "predictionType",
                   p.match_minute AS "matchMinute", p.current_home_score AS "currentHomeScore", p.current_away_score AS "currentAwayScore",
                   s.method AS "method", s.simulation_count AS "simulationCount", s.random_seed AS "randomSeed",
                   s.algorithm_version AS "algorithmVersion",
                   s.expected_remaining_home_goals AS "expectedHomeGoals", s.expected_remaining_away_goals AS "expectedAwayGoals",
                   s.expected_remaining_home_corners AS "expectedHomeCorners", s.expected_remaining_away_corners AS "expectedAwayCorners",
                   s.probabilities::text AS "probabilitiesJson", s.correct_score_distribution::text AS "distributionJson",
                   cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore", cs.probability AS "correctScoreProbability",
                   m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
                   m.final_home_corners AS "finalHomeCorners", m.final_away_corners AS "finalAwayCorners",
                   CASE WHEN m.status = 'FINISHED' THEN %s END AS "actualRemainingGoals",
                   (SELECT COALESCE(r.result, 'PENDING') FROM prediction_picks pk
                      LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
                     WHERE pk.prediction_id = p.id ORDER BY pk.pick_rank LIMIT 1) AS "topPickResult"
            %s %s ORDER BY p.predicted_at DESC, p.id LIMIT :limit OFFSET :offset
            """.formatted(actualRemaining, MC_FROM, w.sql()), w.params, Sql.ROW);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("summary", summary);
        out.put("page", Paging.response(rows, pg, sz, total));
        return out;
    }

    // ------------------------------------------------------------------ Dashboard
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(Filters f, String timezone) {
        String tz = zone(timezone);
        Sql.Where pred = f.where(false);
        Map<String, Object> totals = jdbc.query("""
            SELECT count(*) AS "totalPredictions", count(DISTINCT p.match_id) AS "totalMatches",
                   count(DISTINCT p.ai_model_id) AS "activeModels"
            FROM predictions p JOIN matches m ON m.id = p.match_id %s
            """.formatted(pred.sql()), pred.params, Sql.ROW).getFirst();
        totals.put("totalModels", jdbc.queryForObject("SELECT count(*) FROM ai_models", Map.of(), Long.class));

        Filters today = new Filters(null, null, f.league(), f.modelId(), f.providerId(), f.type(), f.market(), null, null, null);
        // [start of today, start of tomorrow) in the viewer's time zone; future-dated snapshots are not "today".
        Sql.Where tw = today.where(false).and("p.predicted_at >= date_trunc('day', now() AT TIME ZONE :tz) AT TIME ZONE :tz"
            + " AND p.predicted_at < (date_trunc('day', now() AT TIME ZONE :tz) + interval '1 day') AT TIME ZONE :tz", "tz", tz);
        totals.put("predictionsToday", jdbc.queryForObject("SELECT count(*) FROM predictions p JOIN matches m ON m.id = p.match_id"
            + tw.sql(), tw.params, Long.class));

        Sql.Where pw = f.where(true);
        Map<String, Object> picks = jdbc.query("SELECT " + AGG + PICKS_FROM + pw.sql(), pw.params, Sql.ROW).getFirst();
        addWinRate(picks);
        totals.putAll(picks);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totals", totals);
        pw.params.addValue("tz", tz);
        List<Map<String, Object>> daily = jdbc.query("""
            SELECT to_char(date_trunc('day', p.predicted_at AT TIME ZONE :tz), 'YYYY-MM-DD') AS "day",
                   %s AS "wins", %s AS "losses", %s AS "settled"
            %s %s GROUP BY 1 ORDER BY 1
            """.formatted(Stats.WINS, Stats.LOSSES, Stats.SETTLED, PICKS_FROM, pw.sql()), pw.params, Sql.ROW);
        daily.forEach(ReportService::addWinRate);
        out.put("winRateOverTime", daily);
        out.put("predictionsByModel", jdbc.query("""
            SELECT am.name || ' ' || am.version AS "model", count(*) AS "predictions"
            FROM predictions p JOIN matches m ON m.id = p.match_id JOIN ai_models am ON am.id = p.ai_model_id
            %s GROUP BY 1 ORDER BY 2 DESC LIMIT 20
            """.formatted(pred.sql()), pred.params, Sql.ROW));
        out.put("predictionsByMarket", jdbc.query("SELECT pk.market AS \"market\", count(*) AS \"picks\" " + PICKS_FROM
            + pw.sql() + " GROUP BY 1 ORDER BY 2 DESC", pw.params, Sql.ROW));
        out.put("resultDistribution", jdbc.query("SELECT COALESCE(r.result, 'PENDING') AS \"result\", count(*) AS \"picks\" "
            + PICKS_FROM + pw.sql() + " GROUP BY 1 ORDER BY 2 DESC", pw.params, Sql.ROW));
        out.put("modelPerformance", breakdown(f, "model"));
        return out;
    }

    static String zone(String timezone) {
        if (timezone == null || timezone.isBlank()) return "UTC";
        try {
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException e) {
            throw ApiException.badRequest("INVALID_TIMEZONE", "Unknown time zone");
        }
    }
}
