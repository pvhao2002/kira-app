package com.matchmind.prompt;

import com.matchmind.shared.Bands;
import com.matchmind.shared.Sql;
import com.matchmind.shared.Stats;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

/**
 * How past picks did against the market, written into the prediction prompt when it is copied ({@code {{TRACK_RECORD}}}),
 * so the agent sees where its edges held: by rank, market and side, price, edge over the market and prediction type.
 * Every group sets its hit rate ({@link Stats#PICK_HIT}) against the bookmaker's probability without margin; FAVOUR and
 * AVOID name only the groups that beat or trail the market beyond chance ({@link Stats#versusMarket}). PUSH and VOID
 * are left out. Price and edge bands are {@link Bands}, the same as the prompt-tuning report.
 */
@Component
@RequiredArgsConstructor
public class TrackRecord {
    static final String PLACEHOLDER = "{{TRACK_RECORD}}";
    static final int DAYS = 60;
    /** Groups a pick falls into: its rank, market and side, price band, edge over the market and prediction type. */
    private static final String SQL = """
        SELECT pk.pick_rank AS rank, pk.market || ' ' || pk.pick AS side, p.prediction_type AS type, pk.probability AS prob,
               %s AS market, 'price ' || %s AS price, 'edge ' || %s AS edge, %s AS won
        FROM prediction_picks pk
        JOIN predictions p ON p.id = pk.prediction_id
        JOIN matches m ON m.id = p.match_id
        JOIN prediction_odds o ON o.id = pk.odds_id
        JOIN prediction_pick_results r ON r.pick_id = pk.id AND r.is_current
        WHERE r.result IN ('WIN', 'HALF_WIN', 'LOSS', 'HALF_LOSS') AND pk.pick_rank <= 2
          AND m.start_time > now() - make_interval(days => :days)""".formatted(Sql.MARKET_PROBABILITY,
        Bands.sql(Sql.PRICE, Bands.PRICE), Bands.sql(Sql.EDGE, Bands.EDGE), Stats.PICK_HIT);

    /** {@code price} and {@code edge} are band labels ("price 1.66-1.80"); {@code won} is the pick's hit, 0 to 1. */
    record Pick(int rank, String side, String type, double prob, double market, String price, String edge, double won) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public String text() {
        List<Pick> picks = jdbc.query(SQL, Map.of("days", DAYS), (rs, i) -> new Pick(rs.getInt("rank"), rs.getString("side"),
            rs.getString("type"), rs.getDouble("prob"), rs.getDouble("market"), rs.getString("price"), rs.getString("edge"),
            rs.getDouble("won")));
        return format(picks);
    }

    private record Stat(String name, int n, double hit, double claimed, double market) {
        String line() { return "%s %d%% vs market %d%% (n %d)".formatted(name, pct(hit), pct(market), n); }

        int versusMarket() { return Stats.versusMarket(n, hit, market); }
    }

    private static Stat stat(String name, List<Pick> ps) {
        return new Stat(name, ps.size(), avg(ps, Pick::won), avg(ps, Pick::prob), avg(ps, Pick::market));
    }

    private static double avg(List<Pick> ps, ToDoubleFunction<Pick> f) {
        return ps.stream().mapToDouble(f).average().orElse(0);
    }

    private static int pct(double v) { return (int) Math.round(v * 100); }

    private static List<Stat> by(List<Pick> picks, java.util.function.Function<Pick, String> key) {
        return picks.stream().collect(Collectors.groupingBy(key, java.util.TreeMap::new, Collectors.toList()))
            .entrySet().stream().map(e -> stat(e.getKey(), e.getValue())).toList();
    }

    static String format(List<Pick> picks) {
        if (picks.isEmpty()) return "- No settled picks yet in the last " + DAYS + " days: follow SELECTION RULES as written.";
        List<String> out = new ArrayList<>();
        out.add(("- Settled picks, last %d days: %d. Hit = what a pick paid back divided by its price: a win 100%%, a loss"
            + " 0%%, a half win or half loss in between. Market = the bookmaker's probability without margin. Both compare"
            + " straight with your probability.").formatted(DAYS, picks.size()));
        for (Stat s : by(picks, p -> "rank " + p.rank())) {
            int gap = pct(s.claimed()) - pct(s.hit());
            String calibration = gap >= 3 ? gap + " points too sure" : gap <= -3 ? -gap + " points too cautious" : "well calibrated";
            String verdict = s.n() < Stats.MIN_GROUP ? "too few picks to judge against the market" : switch (s.versusMarket()) {
                case 1 -> "beat the market";
                case -1 -> "trailed the market";
                default -> "no proven edge over the market";
            };
            out.add("- %s: hit %d%% of %d; you said %d%% (%s); market %d%% -> %s.".formatted(s.name(), pct(s.hit()), s.n(),
                pct(s.claimed()), calibration, pct(s.market()), verdict));
        }
        List<Stat> sides = by(picks, Pick::side), bands = by(picks, Pick::price), edges = by(picks, Pick::edge),
            types = by(picks, Pick::type);
        out.add("- By market and side: " + join(sides));
        out.add("- By price: " + join(bands));
        out.add("- By your edge over the market (R - M of SELECTION RULES b: (your probability - the market's) * price): "
            + join(edges));
        out.add("- By prediction type: " + join(types));
        List<Stat> groups = new ArrayList<>(sides);
        groups.addAll(bands);
        groups.addAll(edges);
        List<Stat> favour = groups.stream().filter(s -> s.versusMarket() > 0).toList();
        List<Stat> avoid = groups.stream().filter(s -> s.versusMarket() < 0).toList();
        out.add("- FAVOUR (beat the market by more than two standard errors, at least %d picks): %s"
            .formatted(Stats.MIN_GROUP, favour.isEmpty() ? "none yet" : join(favour)));
        out.add("- AVOID (trailed the market by more than two standard errors, at least %d picks): %s"
            .formatted(Stats.MIN_GROUP, avoid.isEmpty() ? "none yet" : join(avoid)));
        return String.join("\n", out);
    }

    private static String join(List<Stat> stats) {
        return stats.stream().map(Stat::line).collect(Collectors.joining(" · "));
    }
}
