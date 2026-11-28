package com.matchmind.report;

import com.matchmind.shared.Bands;
import com.matchmind.shared.Filters;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What an AI agent needs to tune the prediction prompt: the settled picks grouped every way a prompt rule can act on
 * (rank, market and side, price, edge over the market, stated probability, line type, minute, score, prompt version,
 * model, league), the prompt's SELECTION RULES checked against them, expected vs actual goals, and all of it as text.
 * Same filters and count policy as every report, aggregated in SQL; the {@code result} filter is ignored.
 */
@Service
@RequiredArgsConstructor
public class PromptTuningService {
    private static final String SETTLED = "r.result IS NOT NULL AND r.result <> 'PENDING'";
    private static final String COLUMNS = ReportService.AGG + ", round(avg(" + Sql.MARKET_PROBABILITY + "), 4) AS \"avgMarketProbability\", "
        + Stats.HIT_RATE + " AS \"hitRate\" ";
    /**
     * The AI_PREDICTION version saved last before the prediction was made (prompt_template_versions, V16), with its
     * template's name: when several AI_PREDICTION templates exist, the key says whose version it is.
     */
    private static final String PROMPT_VERSION_JOIN = """
         LEFT JOIN LATERAL (SELECT t.name, v.version, v.created_at FROM prompt_template_versions v
                            JOIN prompt_templates t ON t.id = v.template_id
                            WHERE t.template_type = 'AI_PREDICTION' AND v.created_at <= p.predicted_at
                            ORDER BY v.created_at DESC, v.version DESC LIMIT 1) pv ON true
        """;

    /** One grouping: SQL key and order on the pick aliases, plus a join only that grouping needs. */
    private record Dimension(String by, String title, String key, String order, String join) {
        Dimension(String by, String title, String key, String order) {
            this(by, title, key, order, "");
        }
    }

    private static final String BY_PICKS = "count(pk.id) DESC, 1";
    private static final List<Dimension> DIMENSIONS = List.of(
        new Dimension("rank", "Pick rank", "'rank ' || pk.pick_rank", "min(pk.pick_rank)"),
        new Dimension("side", "Market and side", "pk.market || ' ' || pk.pick", BY_PICKS),
        new Dimension("price", "Price", "'price ' || " + Bands.sql(Sql.PRICE, Bands.PRICE), "min(" + Sql.PRICE + ")"),
        new Dimension("edge", "Edge over the market ((stated - market) x price, as in SELECTION RULES)", "'edge ' || " + Bands.sql(Sql.EDGE, Bands.EDGE),
            "min(" + Sql.EDGE + ")"),
        new Dimension("probability", "Stated probability", "'stated ' || " + Bands.sql("pk.probability", Bands.PROBABILITY),
            "min(pk.probability)"),
        new Dimension("line", "Line type", """
            CASE WHEN o.line IS NULL THEN pk.market WHEN mod(abs(o.line) * 4, 2) = 1 THEN pk.market || ' quarter line'
                 WHEN mod(abs(o.line) * 2, 2) = 1 THEN pk.market || ' half line' ELSE pk.market || ' whole line' END""", BY_PICKS),
        new Dimension("minute", "Match minute at the prediction", """
            CASE WHEN p.prediction_type = 'PRE_MATCH' THEN 'pre-match' WHEN p.match_minute <= 30 THEN 'live minute 0-30'
                 WHEN p.match_minute <= 60 THEN 'live minute 31-60' WHEN p.match_minute <= 75 THEN 'live minute 61-75'
                 ELSE 'live minute 76+' END""", "min(COALESCE(p.match_minute, -1))"),
        new Dimension("state", "Score at the prediction", """
            CASE WHEN p.prediction_type = 'PRE_MATCH' THEN 'pre-match' WHEN p.current_home_score = p.current_away_score
                 THEN 'live, level' WHEN abs(p.current_home_score - p.current_away_score) = 1 THEN 'live, one goal apart'
                 ELSE 'live, two or more goals apart' END""",
            "min(CASE WHEN p.prediction_type = 'PRE_MATCH' THEN -1 ELSE abs(p.current_home_score - p.current_away_score) END)"),
        new Dimension("promptVersion", "Prompt version in force when the prediction was made",
            "COALESCE(pv.name || ' v' || pv.version || ' (saved ' || to_char(pv.created_at, 'YYYY-MM-DD') || ')',"
                + " 'before the first saved version')",
            "max(pv.created_at) NULLS FIRST", PROMPT_VERSION_JOIN),
        new Dimension("model", "Model", Sql.MODEL_NAME + " || ' ' || am.version", BY_PICKS),
        new Dimension("league", "League", "COALESCE(mm_league(m.league), '(no league)')", BY_PICKS));

    /** The prediction prompt's SELECTION RULES (V45); {@code follows} is the SQL test a pick passes when it keeps the rule. */
    // ponytail: thresholds copied from the V45 prompt text; when an admin changes the prompt's rules, change them here
    // too. Upgrade path: take them as query parameters (a what-if of other windows) or read them from the template.
    private record Rule(String rule, String text, String follows) {
    }

    private static final String PRICE_WINDOW = "(" + Sql.PRICE + ") > 1.65 AND (" + Sql.PRICE + ") <= 1.90";
    private static final String RANK2_OTHER_MARKET = "(pk.pick_rank = 1 OR pk.market IS DISTINCT FROM (SELECT x.market "
        + "FROM prediction_picks x WHERE x.prediction_id = pk.prediction_id AND x.pick_rank = 1))";
    /** V45's gate on the stated probability, (1 + R) / price: edge R - M is {@link Sql#EDGE}, R = stated x price - 1. */
    private static final String EDGE_GATE = "((" + Sql.EDGE + ") >= 0.10 AND pk.probability * (" + Sql.PRICE + ") - 1 >= 0.03)";
    private static final List<Rule> RULES = List.of(
        new Rule("price", "Price above 1.65 and at most 1.90", PRICE_WINDOW),
        new Rule("rank2", "Rank 2 only in another market than rank 1", RANK2_OTHER_MARKET),
        new Rule("market", "Edge over the market at least 0.10 ((stated - market) x price) and expected return at least"
            + " 0.03 (stated x price - 1)", EDGE_GATE),
        new Rule("all", "All three rules", PRICE_WINDOW + " AND " + RANK2_OTHER_MARKET + " AND " + EDGE_GATE));

    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public Map<String, Object> report(Filters f) {
        Filters settled = new Filters(f.from(), f.to(), f.league(), f.modelId(), f.providerId(), f.type(), f.market(),
            f.matchId(), f.search(), null, f.includeArchived(), f.countPolicy());

        Sql.Where tw = settled.where(true).and(SETTLED);
        Map<String, Object> total = jdbc.query("SELECT " + COLUMNS + ReportService.PICKS_FROM + tw.sql(), tw.params, Sql.ROW).getFirst();
        ReportService.addRates(total);

        List<Map<String, Object>> rules = new ArrayList<>();
        for (Rule rule : RULES) {
            Sql.Where w = settled.where(true).and(SETTLED);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("rule", rule.rule());
            out.put("text", rule.text());
            out.put("follows", null);
            out.put("breaks", null);
            jdbc.query("SELECT CASE WHEN " + rule.follows() + " THEN 'follows' ELSE 'breaks' END AS \"key\", " + COLUMNS
                + ReportService.PICKS_FROM + w.sql() + " GROUP BY 1", w.params, Sql.ROW).forEach(row -> {
                ReportService.addRates(row);
                out.put((String) row.remove("key"), row);
            });
            rules.add(out);
        }

        List<Map<String, Object>> dimensions = new ArrayList<>();
        for (Dimension d : DIMENSIONS) {
            Sql.Where w = settled.where(true).and(SETTLED);
            List<Map<String, Object>> rows = jdbc.query("SELECT " + d.key() + " AS \"key\", " + COLUMNS + ReportService.PICKS_FROM
                + d.join() + w.sql() + " GROUP BY 1 ORDER BY " + d.order(), w.params, Sql.ROW);
            rows.forEach(ReportService::addRates);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("by", d.by());
            out.put("title", d.title());
            out.put("rows", rows);
            dimensions.add(out);
        }

        Map<String, Object> goals = goals(settled);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("rules", rules);
        out.put("dimensions", dimensions);
        out.put("goals", goals);
        out.put("text", PromptTuningText.render(scope(settled), total, rules, dimensions, goals));
        return out;
    }

    /** Goals the simulations expected after the prediction against what came, over finished simulated predictions. */
    private Map<String, Object> goals(Filters f) {
        Sql.Where w = f.where(false).and("m.status = 'FINISHED'")
            .and("s.expected_remaining_home_goals IS NOT NULL AND s.expected_remaining_away_goals IS NOT NULL");
        return jdbc.query("""
            SELECT count(*) AS "predictions",
                   round(avg(s.expected_remaining_home_goals + s.expected_remaining_away_goals), 2) AS "avgExpectedGoals",
                   round(avg(m.final_home_score + m.final_away_score - COALESCE(p.current_home_score, 0)
                             - COALESCE(p.current_away_score, 0)), 2) AS "avgActualGoals"
            FROM predictions p JOIN prediction_simulations s ON s.prediction_id = p.id JOIN matches m ON m.id = p.match_id
            """ + Sql.EFFECTIVE_MODEL_JOIN + w.sql(), w.params, Sql.ROW).getFirst();
    }

    /** The filters in words, so a pasted report says what it covers. */
    static String scope(Filters f) {
        StringBuilder s = new StringBuilder("predicted from ").append(f.from() == null ? "the first prediction" : f.from())
            .append(" to ").append(f.to() == null ? "now" : f.to());
        s.append(" · ").append(f.type() == null || f.type().isBlank() ? "PRE_MATCH and LIVE" : f.type());
        if (f.market() != null && !f.market().isBlank()) s.append(" · market ").append(f.market());
        if (f.league() != null && !f.league().isBlank()) s.append(" · league ").append(f.league());
        if (f.modelId() != null) s.append(" · one model");
        if (f.providerId() != null) s.append(" · one provider");
        if (f.search() != null && !f.search().isBlank()) s.append(" · search \"").append(f.search()).append('"');
        return s.append(f.countsLatest() ? " · latest prediction per match, model, type and minute" : " · every prediction")
            .toString();
    }
}
