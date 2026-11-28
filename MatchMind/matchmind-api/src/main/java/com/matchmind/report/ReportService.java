package com.matchmind.report;

import com.matchmind.match.MatchQueryService;
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

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
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
        List.of("picks", "settled", "wins", "losses", "pushOrVoid", "pending", "halfWins", "halfLosses", "fullWins", "fullLosses",
            "staked");
    private final NamedParameterJdbcTemplate jdbc;

    /** Pick-level base: every pick with its prediction, match, model, odds snapshot and current settlement. */
    static final String PICKS_FROM = """
        FROM prediction_picks pk
        JOIN predictions p ON p.id = pk.prediction_id
        JOIN matches m ON m.id = p.match_id
        """ + Sql.EFFECTIVE_MODEL_JOIN + """
        JOIN prediction_odds o ON o.id = pk.odds_id
        """ + Stats.CURRENT_RESULT_JOIN;

    /**
     * wins/losses include the halves (win-rate basis). fullWins + halfWins + fullLosses + halfLosses + pushOrVoid
     * = settled, so those five are the mutually exclusive split. units/staked: fixed stake of 1 per pick (UX-018).
     */
    static final String AGG = """
        count(pk.id) AS "picks", %s AS "settled", %s AS "wins", %s AS "losses", %s AS "pushOrVoid", %s AS "pending",
        count(*) FILTER (WHERE r.result = 'HALF_WIN') AS "halfWins", count(*) FILTER (WHERE r.result = 'HALF_LOSS') AS "halfLosses",
        count(*) FILTER (WHERE r.result = 'WIN') AS "fullWins", count(*) FILTER (WHERE r.result = 'LOSS') AS "fullLosses",
        round(avg(pk.probability), 4) AS "avgProbability", %s AS "units", %s AS "staked"
        """.formatted(Stats.SETTLED, Stats.WINS, Stats.LOSSES, Stats.PUSH_VOID, Stats.PENDING, Stats.UNITS, Stats.STAKED);

    /** winRate, and roi when the row has units/staked. */
    static void addRates(Map<String, Object> row) {
        row.put("winRate", Stats.winRate(num(row.get("wins")), num(row.get("losses"))));
        if (row.containsKey("staked")) row.put("roi", Stats.roi((BigDecimal) row.get("units"), num(row.get("staked"))));
    }

    static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    // ------------------------------------------------------------------ Report 1: AI model performance
    @Transactional(readOnly = true)
    public List<Map<String, Object>> modelPerformance(Filters f) {
        Sql.Where pickWhere = f.where(true);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT am.id AS "modelId", %1$s AS "modelName", am.name AS "modelKey", am.version AS "modelVersion",
                   pv.name AS "providerName", count(DISTINCT p.id) AS "predictions", %2$s
            %3$s JOIN providers pv ON pv.id = am.provider_id
            %4$s GROUP BY am.id, am.display_name, am.name, am.version, pv.name ORDER BY %1$s, am.version
            """.formatted(Sql.MODEL_NAME, AGG, PICKS_FROM, pickWhere.sql()), pickWhere.params, Sql.ROW);

        Sql.Where predWhere = f.where(false);
        Map<Object, Map<String, Object>> cs = new LinkedHashMap<>();
        jdbc.query("""
            SELECT am.id AS "modelId",
                   count(*) FILTER (WHERE m.status = 'FINISHED') AS "correctScoreEvaluated",
                   count(*) FILTER (WHERE m.status = 'FINISHED' AND cs.home_score = m.final_home_score
                                    AND cs.away_score = m.final_away_score) AS "correctScoreHits"
            FROM predictions p JOIN matches m ON m.id = p.match_id %s
            JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
            %s GROUP BY am.id
            """.formatted(Sql.EFFECTIVE_MODEL_JOIN, predWhere.sql()), predWhere.params, Sql.ROW).forEach(r -> cs.put(r.get("modelId"), r));
        Map<Object, Object> notCounted = notCountedByModel(f);
        for (Map<String, Object> row : rows) {
            addRates(row);
            Map<String, Object> c = cs.getOrDefault(row.get("modelId"), Map.of());
            long evaluated = num(c.get("correctScoreEvaluated")), hits = num(c.get("correctScoreHits"));
            row.put("correctScoreEvaluated", evaluated);
            row.put("correctScoreHits", hits);
            row.put("correctScoreAccuracy", Stats.ratio(hits, evaluated));
            row.put("notCountedPredictions", num(notCounted.get(row.get("modelId"))));
        }
        return rows;
    }

    /**
     * UX-046: predictions inside the filters that the count policy leaves out, by effective model (empty under
     * {@code all}). The footnote "N predictions not counted" of the dashboard and the reports.
     */
    private Map<Object, Object> notCountedByModel(Filters f) {
        Map<Object, Object> out = new LinkedHashMap<>();
        if (!f.countsLatest()) return out;
        Sql.Where w = f.where(false, false).and("NOT " + Stats.COUNTED);
        jdbc.query("SELECT am.id AS \"modelId\", count(*) AS \"n\" FROM predictions p JOIN matches m ON m.id = p.match_id"
            + Sql.EFFECTIVE_MODEL_JOIN + w.sql() + " GROUP BY am.id", w.params, Sql.ROW).forEach(r -> out.put(r.get("modelId"), r.get("n")));
        return out;
    }

    /** Drill-down of one model (or all models when modelId is null) by market, league, prediction type or odds stage. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> breakdown(Filters f, String by) {
        return breakdown(f.where(true), by);
    }

    private List<Map<String, Object>> breakdown(Sql.Where w, String by) {
        String key = switch (by == null ? "market" : by) {
            case "market" -> "pk.market";
            case "league" -> "mm_league(m.league)";
            case "type" -> "p.prediction_type";
            case "stage" -> "o.odds_stage";
            case "model" -> Sql.MODEL_NAME + " || ' ' || am.version";
            default -> throw ApiException.badRequest("INVALID_GROUP", "by must be market, league, type, stage or model");
        };
        List<Map<String, Object>> rows = jdbc.query("SELECT " + key + " AS \"key\", " + AGG + PICKS_FROM + w.sql()
            + " GROUP BY 1 ORDER BY count(pk.id) DESC, 1", w.params, Sql.ROW);
        rows.forEach(ReportService::addRates);
        return rows;
    }

    /** A prediction's top pick: its lowest pick_rank (same meaning as ORDER BY pick_rank LIMIT 1 elsewhere). */
    static final String TOP_PICK = "pk.pick_rank = (SELECT min(x.pick_rank) FROM prediction_picks x WHERE x.prediction_id = p.id)";

    /** {@link #breakdown} counting only each prediction's top pick, plus the overall total. */
    @Transactional(readOnly = true)
    public Map<String, Object> topPick(Filters f, String by) {
        if (!List.of("model", "market", "league", "type").contains(by)) {
            throw ApiException.badRequest("INVALID_GROUP", "by must be model, market, league or type");
        }
        Sql.Where w = f.where(true).and(TOP_PICK);
        Map<String, Object> total = jdbc.query("SELECT " + AGG + PICKS_FROM + w.sql(), w.params, Sql.ROW).getFirst();
        addRates(total);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("rows", breakdown(w, by));
        return out;
    }

    /**
     * PRE_MATCH and LIVE pick performance side by side per model, market or league. The type filter is ignored (both
     * types are the point); a side with no picks is null. Deltas are LIVE minus PRE_MATCH, null when either rate is null.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> typeComparison(Filters f, String by) {
        String key = switch (by == null ? "model" : by) {
            case "model" -> Sql.MODEL_NAME + " || ' ' || am.version";
            case "market" -> "pk.market";
            case "league" -> "mm_league(m.league)";
            default -> throw ApiException.badRequest("INVALID_GROUP", "by must be model, market or league");
        };
        Sql.Where w = new Filters(f.from(), f.to(), f.league(), f.modelId(), f.providerId(), null, f.market(), f.matchId(),
            f.search(), f.result(), f.includeArchived(), f.countPolicy()).where(true);
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        jdbc.query("SELECT " + key + " AS \"key\", p.prediction_type AS \"type\", " + AGG + PICKS_FROM + w.sql() + " GROUP BY 1, 2",
            w.params, Sql.ROW).forEach(r -> {
            String type = (String) r.remove("type");
            addRates(r);
            Map<String, Object> out = byKey.computeIfAbsent((String) r.get("key"), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("key", k);
                return m;
            });
            r.remove("key");
            out.put("PRE_MATCH".equals(type) ? "preMatch" : "live", r);
        });
        List<Map<String, Object>> rows = new ArrayList<>(byKey.values());
        for (Map<String, Object> row : rows) {
            row.putIfAbsent("preMatch", null);
            row.putIfAbsent("live", null);
            row.put("winRateDelta", delta(row, "winRate"));
            row.put("roiDelta", delta(row, "roi"));
        }
        rows.sort((a, b) -> {
            int c = Long.compare(picks(b), picks(a));
            return c != 0 ? c : ((String) a.get("key")).compareTo((String) b.get("key"));
        });
        return rows;
    }

    @SuppressWarnings("unchecked")
    private static BigDecimal delta(Map<String, Object> row, String field) {
        Map<String, Object> pre = (Map<String, Object>) row.get("preMatch"), live = (Map<String, Object>) row.get("live");
        if (pre == null || live == null || pre.get(field) == null || live.get(field) == null) return null;
        return ((BigDecimal) live.get(field)).subtract((BigDecimal) pre.get(field));
    }

    @SuppressWarnings("unchecked")
    private static long picks(Map<String, Object> row) {
        long n = 0;
        for (String side : List.of("preMatch", "live")) {
            Map<String, Object> s = (Map<String, Object>) row.get(side);
            if (s != null) n += num(s.get("picks"));
        }
        return n;
    }

    // ------------------------------------------------------------------ Win/loss patterns
    private static final int DEFAULT_MIN_SAMPLE = 20;
    private static final int MAX_MIN_SAMPLE = 1000;
    /** Two-sided 95%: a group whose win rate is this many standard errors from the overall rate is flagged. */
    private static final BigDecimal Z_95 = new BigDecimal("1.96");

    /**
     * Each pick unpivoted into the groups it falls into, in display order. A NULL value means the pick is not in that
     * factor (e.g. minute and score state are LIVE only; score state is goals, so goal markets only) and is skipped. Price bands match {@code TrackRecord.priceBand}.
     */
    private static final String PATTERN_FACTORS = """
         CROSS JOIN LATERAL (VALUES
          (1, 'market', pk.market),
          (2, 'side', pk.market || ' ' || pk.pick),
          (3, 'type', p.prediction_type),
          (4, 'stage', o.odds_stage),
          (5, 'league', mm_league(m.league)),
          (6, 'model', %1$s || ' ' || am.version),
          (7, 'rank', CASE WHEN pk.pick_rank >= 3 THEN '3+' ELSE pk.pick_rank::text END),
          (8, 'probability', CASE WHEN pk.probability < 0.4 THEN '<40%%' WHEN pk.probability < 0.5 THEN '40-50%%'
               WHEN pk.probability < 0.6 THEN '50-60%%' WHEN pk.probability < 0.7 THEN '60-70%%' ELSE '70%%+' END),
          (9, 'price', CASE WHEN (%2$s) IS NULL THEN NULL WHEN (%2$s) <= 1.65 THEN '1.65 or lower'
               WHEN (%2$s) <= 1.80 THEN '1.66-1.80' WHEN (%2$s) <= 1.90 THEN '1.81-1.90'
               WHEN (%2$s) <= 2.05 THEN '1.91-2.05' ELSE 'above 2.05' END),
          (10, 'line', CASE WHEN o.line IS NOT NULL THEN pk.market || ' ' || pk.pick || ' ' || trim_scale(o.line)::text END),
          (11, 'minute', CASE WHEN p.prediction_type = 'LIVE' AND p.match_minute IS NOT NULL THEN CASE
               WHEN p.match_minute <= 15 THEN '0-15' WHEN p.match_minute <= 30 THEN '16-30' WHEN p.match_minute <= 45 THEN '31-45'
               WHEN p.match_minute <= 60 THEN '46-60' WHEN p.match_minute <= 75 THEN '61-75' ELSE '76+' END END),
          (12, 'scoreState', CASE WHEN p.prediction_type <> 'LIVE' OR p.current_home_score IS NULL
                                    OR pk.market NOT IN ('1X2', 'AH', 'OU') THEN NULL
               WHEN p.current_home_score = p.current_away_score THEN 'Level'
               WHEN pk.pick NOT IN ('HOME', 'AWAY') THEN 'Not level'
               WHEN (pk.pick = 'HOME') = (p.current_home_score > p.current_away_score) THEN 'Pick side leading'
               ELSE 'Pick side trailing' END)
        ) f(ord, factor, value)
        """.formatted(Sql.MODEL_NAME, Sql.PRICE);

    /**
     * What winning and losing picks have in common: pick performance per value of each factor, compared with the
     * overall win rate. Same filters, count policy and formulas as the other reports.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> patterns(Filters f, Integer minSample) {
        int min = minSample == null ? DEFAULT_MIN_SAMPLE : Math.max(1, Math.min(minSample, MAX_MIN_SAMPLE));
        Sql.Where ow = f.where(true);
        Map<String, Object> overall = jdbc.query("SELECT " + AGG + PICKS_FROM + ow.sql(), ow.params, Sql.ROW).getFirst();
        addRates(overall);
        BigDecimal baseline = (BigDecimal) overall.get("winRate");

        Sql.Where w = f.where(true).and("f.value IS NOT NULL");
        List<Map<String, Object>> rows = jdbc.query("SELECT f.factor AS \"factor\", f.value AS \"value\", " + AGG + PICKS_FROM
            + PATTERN_FACTORS + w.sql() + " GROUP BY f.ord, f.factor, f.value ORDER BY f.ord, count(pk.id) DESC, f.value",
            w.params, Sql.ROW);
        for (Map<String, Object> row : rows) {
            addRates(row);
            addSignal(row, baseline, min);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("overall", overall);
        out.put("minSample", min);
        out.put("rows", rows);
        return out;
    }

    /**
     * lift = row win rate minus the baseline; z = lift / sqrt(p0(1-p0)/n) over the n decisive picks; signal WARNING or
     * STRENGTH when n reaches minSample and |z| >= 1.96. Null when a rate is unknown or the baseline is 0 or 1.
     */
    static void addSignal(Map<String, Object> row, BigDecimal baseline, int minSample) {
        BigDecimal rate = (BigDecimal) row.get("winRate"), lift = null, z = null;
        String signal = null;
        long n = num(row.get("wins")) + num(row.get("losses"));
        if (rate != null && baseline != null) {
            lift = rate.subtract(baseline);
            BigDecimal variance = baseline.multiply(BigDecimal.ONE.subtract(baseline));
            if (variance.signum() > 0) {
                BigDecimal se = variance.divide(BigDecimal.valueOf(n), MathContext.DECIMAL64).sqrt(MathContext.DECIMAL64);
                BigDecimal raw = lift.divide(se, MathContext.DECIMAL64); // compare unrounded: 1.955 must not flag
                if (n >= minSample && raw.abs().compareTo(Z_95) >= 0) signal = raw.signum() < 0 ? "WARNING" : "STRENGTH";
                z = raw.setScale(2, RoundingMode.HALF_UP);
            }
        }
        row.put("lift", lift);
        row.put("z", z);
        row.put("signal", signal);
    }

    // ------------------------------------------------------------------ Calibration (UX-018)
    private static final int CALIBRATION_BINS = 10;

    /**
     * Stated probability vs hit rate in 10 fixed bins of width 0.1 (probability 1 lands in bin 10). Only WIN (1) and
     * LOSS (0) are evaluated; other settled results (halves, PUSH, VOID) are counted as {@code excluded}. Every pick of
     * every rank; same filters and count policy as the win rate. Always 10 bins: empty ones have nulls.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> calibration(Filters f) {
        Sql.Where w = f.where(true);
        Map<Integer, Map<String, Object>> found = new LinkedHashMap<>();
        jdbc.query("""
            SELECT LEAST(width_bucket(pk.probability, 0, 1, %d), %1$d) AS "bin",
                   count(*) FILTER (WHERE r.result IN ('WIN','LOSS')) AS "picks",
                   count(*) FILTER (WHERE r.result = 'WIN') AS "wins",
                   round(avg(pk.probability) FILTER (WHERE r.result IN ('WIN','LOSS')), 4) AS "avgProbability",
                   count(*) FILTER (WHERE r.result IN ('HALF_WIN','HALF_LOSS','PUSH','VOID')) AS "excluded"
            %s %s GROUP BY 1
            """.formatted(CALIBRATION_BINS, PICKS_FROM, w.sql()), w.params, Sql.ROW)
            .forEach(r -> found.put(((Number) r.get("bin")).intValue(), r));
        List<Map<String, Object>> bins = new ArrayList<>();
        long evaluated = 0, excluded = 0;
        for (int i = 1; i <= CALIBRATION_BINS; i++) {
            Map<String, Object> r = found.getOrDefault(i, Map.of());
            long picks = num(r.get("picks"));
            evaluated += picks;
            excluded += num(r.get("excluded"));
            Map<String, Object> bin = new LinkedHashMap<>();
            bin.put("bin", i);
            bin.put("from", BigDecimal.valueOf(i - 1, 1));
            bin.put("to", BigDecimal.valueOf(i, 1));
            bin.put("picks", picks);
            bin.put("avgProbability", r.get("avgProbability"));
            bin.put("hitRate", Stats.ratio(num(r.get("wins")), picks));
            bins.add(bin);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bins", bins);
        out.put("evaluated", evaluated);
        out.put("excluded", excluded);
        return out;
    }

    // ------------------------------------------------------------------ Report 2: prediction history (pick level)
    static final String HISTORY_COLUMNS = """
        SELECT pk.id AS "pickId", p.id AS "predictionId", p.predicted_at AS "predictedAt", m.id AS "matchId",
               m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam", m.start_time AS "startTime",
               m.status AS "matchStatus", am.id AS "modelId", %s AS "modelName", am.name AS "modelKey",
               am.version AS "modelVersion", p.prediction_type AS "predictionType", p.match_minute AS "matchMinute",
               p.current_home_score AS "currentHomeScore", p.current_away_score AS "currentAwayScore",
               cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore", cs.probability AS "correctScoreProbability",
               m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
               m.final_home_corners AS "finalHomeCorners", m.final_away_corners AS "finalAwayCorners",
               pk.market AS "market", pk.pick AS "pick", pk.pick_rank AS "pickRank", pk.probability AS "probability",
               o.odds_stage AS "oddsStage", o.line AS "line", o.line_display AS "lineDisplay", %s AS "price",
               o.settlement_basis AS "settlementBasis", o.home_score_at_capture AS "homeScoreAtCapture",
               o.away_score_at_capture AS "awayScoreAtCapture",
               COALESCE(r.result, 'PENDING') AS "result", round(%s, 3) AS "units", r.settled_at AS "settledAt",
               r.source AS "settlementSource", %s AS "counted"
        """.formatted(Sql.MODEL_NAME, Sql.PRICE, Stats.PICK_UNITS, Stats.COUNTED);

    static final String HISTORY_FROM = PICKS_FROM
        + " LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1 ";

    private static final Map<String, String> HISTORY_SORT = Map.ofEntries(
        Map.entry("predictedAt", "p.predicted_at"), Map.entry("league", "m.league"), Map.entry("model", Sql.MODEL_NAME),
        Map.entry("market", "pk.market"), Map.entry("probability", "pk.probability"), Map.entry("price", "\"price\""),
        Map.entry("line", "o.line"), Map.entry("result", "\"result\""), Map.entry("minute", "p.match_minute"),
        Map.entry("type", "p.prediction_type"), Map.entry("homeTeam", "m.home_team"));

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> predictionHistory(Filters f, Integer page, Integer size, String sort) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = f.where(true, false); // a list: every row, marked counted or not
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
        "line", "price", "probability", "settlementBasis", "result", "units", "settledAt");

    @Transactional(readOnly = true)
    public List<List<Object>> predictionHistoryExport(Filters f, String sort) {
        Sql.Where w = f.where(true, false);
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
            empty.put("units", null);
            byMarket.put(market, empty);
        }
        jdbc.query("SELECT pk.market AS \"market\", " + AGG + PICKS_FROM + w.sql() + " GROUP BY pk.market", w.params, Sql.ROW)
            .forEach(row -> byMarket.put((String) row.get("market"), row));
        List<Map<String, Object>> rows = new ArrayList<>(byMarket.values());
        rows.forEach(ReportService::addRates);
        return rows;
    }

    // ------------------------------------------------------------------ Report 4: model comparison on the same matches
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> modelComparison(Filters f, Integer minModels, Integer page, Integer size) {
        int pg = Paging.page(page), sz = Math.min(Paging.size(size), MAX_COMPARISON_PAGE_SIZE);
        int min = minModels == null ? DEFAULT_MIN_MODELS : Math.max(1, Math.min(minModels, MAX_MIN_MODELS));
        Sql.Where w = f.where(false);
        w.params.addValue("minModels", min);
        // One row per fixture (UX-047): linked matches of different providers compare together; an unlinked match is
        // its own fixture. The row shows the first-created member that has a matching prediction.
        String keys = "WITH f AS (SELECT " + FIXTURE_KEY + " AS k, m.id AS mid, m.created_at AS mc, am.id AS model"
            + " FROM predictions p JOIN matches m ON m.id = p.match_id" + Sql.EFFECTIVE_MODEL_JOIN + w.sql() + "),"
            + " keys AS (SELECT k FROM f GROUP BY k HAVING count(DISTINCT model) >= :minModels) ";
        long total = jdbc.queryForObject(keys + "SELECT count(*) FROM keys", w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> matches = jdbc.query(keys + """
            , rep AS (SELECT DISTINCT ON (f.k) f.k, f.mid FROM f JOIN keys ON keys.k = f.k ORDER BY f.k, f.mc, f.mid)
            SELECT rep.k AS "fixtureId", m.id AS "matchId", m.league AS "league", m.home_team AS "homeTeam",
                   m.away_team AS "awayTeam", m.start_time AS "startTime", m.status AS "status",
                   m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore",
                   m.final_home_corners AS "finalHomeCorners", m.final_away_corners AS "finalAwayCorners",
                   (SELECT count(DISTINCT (x.final_home_score, x.final_away_score)) FROM matches x
                    WHERE COALESCE(x.fixture_id, x.id) = rep.k AND x.status = 'FINISHED' AND x.archived_at IS NULL) > 1
                       AS "resultMismatch"
            FROM rep JOIN matches m ON m.id = rep.mid ORDER BY m.start_time DESC, m.id LIMIT :limit OFFSET :offset
            """, w.params, Sql.ROW);
        if (matches.isEmpty()) return Paging.response(matches, pg, sz, total);

        Sql.Where inner = f.where(false);
        inner.params.addValue("ids", matches.stream().map(r -> r.get("fixtureId")).toList());
        List<Map<String, Object>> entries = jdbc.query("""
            SELECT DISTINCT ON (%1$s, am.id)
                   %1$s AS "fixtureId", p.match_id AS "matchId", pv.name AS "providerName",
                   p.id AS "predictionId", am.id AS "modelId", %2$s AS "modelName",
                   am.name AS "modelKey", am.version AS "modelVersion", p.predicted_at AS "predictedAt", p.prediction_type AS "predictionType",
                   p.match_minute AS "matchMinute", cs.home_score AS "predictedHomeScore", cs.away_score AS "predictedAwayScore",
                   cs.probability AS "correctScoreProbability",
                   (cs.home_score = m.final_home_score AND cs.away_score = m.final_away_score) AS "correctScoreHit",
                   pk.market AS "market", pk.pick AS "pick", pk.probability AS "probability", o.line AS "line",
                   o.line_display AS "lineDisplay", %3$s AS "price", COALESCE(r.result, 'PENDING') AS "result",
                   (SELECT count(*) FROM predictions q JOIN matches qm ON qm.id = q.match_id
                    WHERE COALESCE(qm.fixture_id, qm.id) = %1$s AND q.ai_model_id IN
                       (SELECT c.id FROM ai_models c WHERE c.id = am.id OR c.merged_into_id = am.id)) AS "predictionCount"
            FROM predictions p JOIN matches m ON m.id = p.match_id JOIN providers pv ON pv.id = p.provider_id %4$s
            LEFT JOIN prediction_correct_scores cs ON cs.prediction_id = p.id AND cs.score_rank = 1
            LEFT JOIN LATERAL (SELECT x.* FROM prediction_picks x WHERE x.prediction_id = p.id ORDER BY x.pick_rank LIMIT 1) pk ON true
            LEFT JOIN prediction_odds o ON o.id = pk.odds_id
            LEFT JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
            WHERE %1$s IN (:ids) %5$s
            ORDER BY %1$s, am.id, p.predicted_at DESC
            """.formatted(FIXTURE_KEY, Sql.MODEL_NAME, Sql.PRICE, Sql.EFFECTIVE_MODEL_JOIN, inner.andSql()), inner.params, Sql.ROW);
        Map<Object, List<Map<String, Object>>> byFixture = new LinkedHashMap<>();
        entries.forEach(e -> byFixture.computeIfAbsent(e.get("fixtureId"), k -> new ArrayList<>()).add(e));
        matches.forEach(mt -> mt.put("models", byFixture.getOrDefault(mt.get("fixtureId"), List.of())));
        return Paging.response(matches, pg, sz, total);
    }

    /** Match alias m -> the fixture it is compared under: its fixture, or itself while unlinked. */
    private static final String FIXTURE_KEY = "COALESCE(m.fixture_id, m.id)";

    /**
     * How many fixtures (rows of the model comparison) each minModels value would return (same filters), from 1 up to the largest model count
     * present, so the UI can default to a value that has data. Empty when nothing matches.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> modelComparisonCoverage(Filters f) {
        Sql.Where w = f.where(false);
        w.params.addValue("maxModels", MAX_MIN_MODELS);
        return jdbc.query("""
            WITH c AS (SELECT count(DISTINCT am.id) AS k FROM predictions p JOIN matches m ON m.id = p.match_id %s
                       %s GROUP BY COALESCE(m.fixture_id, m.id))
            SELECT n AS "minModels", (SELECT count(*) FROM c WHERE c.k >= n) AS "matches"
            FROM generate_series(1, LEAST((SELECT max(k) FROM c), :maxModels)) AS n ORDER BY n
            """.formatted(Sql.EFFECTIVE_MODEL_JOIN, w.sql()), w.params, Sql.ROW);
    }

    // ------------------------------------------------------------------ Report 5: Monte Carlo analysis
    static final String MC_FROM = """
        FROM predictions p
        JOIN prediction_simulations s ON s.prediction_id = p.id
        JOIN matches m ON m.id = p.match_id
        """ + Sql.EFFECTIVE_MODEL_JOIN + """
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
                   %s AS "modelName", am.name AS "modelKey", am.version AS "modelVersion", p.prediction_type AS "predictionType",
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
            """.formatted(Sql.MODEL_NAME, actualRemaining, MC_FROM, w.sql()), w.params, Sql.ROW);
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
                   count(DISTINCT am.id) AS "activeModels",
                   min(p.predicted_at) AS "firstPredictedAt", max(p.predicted_at) AS "lastPredictedAt"
            FROM predictions p JOIN matches m ON m.id = p.match_id %s %s
            """.formatted(Sql.EFFECTIVE_MODEL_JOIN, pred.sql()), pred.params, Sql.ROW).getFirst();
        // The range the KPIs counted: the requested bounds (null = open) and the predictions actually inside them.
        Map<String, Object> period = new LinkedHashMap<>();
        period.put("from", f.from());
        period.put("to", f.to());
        period.put("basis", "predictedAt");
        period.put("firstPredictedAt", totals.remove("firstPredictedAt"));
        period.put("lastPredictedAt", totals.remove("lastPredictedAt"));
        // Models in use: a merged model is counted through its target; archived models and providers are hidden.
        Sql.Where mw = new Sql.Where();
        if (!Boolean.TRUE.equals(f.includeArchived())) {
            mw.and("am.merged_into_id IS NULL AND am.archived_at IS NULL"
                + " AND NOT EXISTS (SELECT 1 FROM providers x WHERE x.id = am.provider_id AND x.archived_at IS NOT NULL)");
        }
        totals.put("totalModels", jdbc.queryForObject("SELECT count(*) FROM ai_models am" + mw.sql(), mw.params, Long.class));
        // Same scope as GET /matches?overdue=true&league=&providerId= so the figure can link to that list.
        Sql.Where ow = new Sql.Where().and(Filters.LEAGUE, "league", f.league())
            .and("m.provider_id = :providerId", "providerId", f.providerId()).and(MatchQueryService.OVERDUE);
        Filters.activeMatches(ow, f.includeArchived(), f.providerId() != null);
        totals.put("overdueMatches", jdbc.queryForObject("SELECT count(*) FROM matches m" + ow.sql(), ow.params, Long.class));

        Filters today = new Filters(null, null, f.league(), f.modelId(), f.providerId(), f.type(), f.market(), null, null, null,
            f.includeArchived(), f.countPolicy());
        // [start of today, start of tomorrow) in the viewer's time zone; future-dated snapshots are not "today".
        Sql.Where tw = today.where(false).and("p.predicted_at >= date_trunc('day', now() AT TIME ZONE :tz) AT TIME ZONE :tz"
            + " AND p.predicted_at < (date_trunc('day', now() AT TIME ZONE :tz) + interval '1 day') AT TIME ZONE :tz", "tz", tz);
        totals.put("predictionsToday", jdbc.queryForObject("SELECT count(*) FROM predictions p JOIN matches m ON m.id = p.match_id"
            + tw.sql(), tw.params, Long.class));

        Sql.Where pw = f.where(true);
        Map<String, Object> picks = jdbc.query("SELECT " + AGG + PICKS_FROM + pw.sql(), pw.params, Sql.ROW).getFirst();
        addRates(picks);
        totals.putAll(picks);
        totals.put("notCountedPredictions", notCountedByModel(f).values().stream().mapToLong(ReportService::num).sum());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", period);
        out.put("totals", totals);
        pw.params.addValue("tz", tz);
        List<Map<String, Object>> daily = jdbc.query("""
            SELECT to_char(date_trunc('day', p.predicted_at AT TIME ZONE :tz), 'YYYY-MM-DD') AS "day",
                   %s AS "wins", %s AS "losses", %s AS "settled", %s AS "units"
            %s %s GROUP BY 1 ORDER BY 1
            """.formatted(Stats.WINS, Stats.LOSSES, Stats.SETTLED, Stats.UNITS, PICKS_FROM, pw.sql()), pw.params, Sql.ROW);
        daily.forEach(ReportService::addRates);
        out.put("winRateOverTime", daily);
        out.put("predictionsByModel", jdbc.query("""
            SELECT %s || ' ' || am.version AS "model", count(*) AS "predictions"
            FROM predictions p JOIN matches m ON m.id = p.match_id %s
            %s GROUP BY 1 ORDER BY 2 DESC LIMIT 20
            """.formatted(Sql.MODEL_NAME, Sql.EFFECTIVE_MODEL_JOIN, pred.sql()), pred.params, Sql.ROW));
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
