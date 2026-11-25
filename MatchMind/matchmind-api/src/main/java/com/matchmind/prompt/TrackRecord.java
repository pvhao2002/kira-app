package com.matchmind.prompt;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * How past picks actually did, written into the prediction prompt when it is copied ({@code {{TRACK_RECORD}}}), so
 * the agent learns from each day's settled results: where it was too sure, which markets and prices lose.
 * A HALF_WIN counts as half a win; PUSH and VOID are left out.
 */
@Component
@RequiredArgsConstructor
public class TrackRecord {
    static final String PLACEHOLDER = "{{TRACK_RECORD}}";
    static final int DAYS = 60, MIN_GROUP = 6;
    /** Groups a pick falls into: its rank, market and side, price band and prediction type. */
    private static final String SQL = """
        SELECT k.pick_rank AS rank, k.market || ' ' || k.pick AS side, p.prediction_type AS type, k.probability AS prob,
               CASE k.pick WHEN 'HOME' THEN o.home_odds WHEN 'AWAY' THEN o.away_odds WHEN 'DRAW' THEN o.draw_odds
                           WHEN 'OVER' THEN o.over_odds ELSE o.under_odds END AS price,
               CASE r.result WHEN 'WIN' THEN 1.0 WHEN 'HALF_WIN' THEN 0.5 ELSE 0.0 END AS won
        FROM prediction_picks k
        JOIN predictions p ON p.id = k.prediction_id
        JOIN matches m ON m.id = p.match_id
        JOIN prediction_odds o ON o.id = k.odds_id
        JOIN prediction_pick_results r ON r.pick_id = k.id AND r.is_current
        WHERE r.result IN ('WIN', 'HALF_WIN', 'LOSS', 'HALF_LOSS') AND k.pick_rank <= 2
          AND m.start_time > now() - make_interval(days => :days)""";

    record Pick(int rank, String side, String type, double prob, double price, double won) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public String text() {
        List<Pick> picks = jdbc.query(SQL, Map.of("days", DAYS), (rs, i) -> new Pick(rs.getInt("rank"), rs.getString("side"),
            rs.getString("type"), rs.getDouble("prob"), rs.getDouble("price"), rs.getDouble("won")));
        return format(picks);
    }

    static String priceBand(double price) {
        return price <= 1.65 ? "1.65 or lower" : price <= 1.80 ? "1.66-1.80" : price <= 1.90 ? "1.81-1.90"
            : price <= 2.05 ? "1.91-2.05" : "above 2.05";
    }

    private record Stat(String name, int n, double win, double claimed) {
        String line() { return "%s %d%% (n %d)".formatted(name, pct(win), n); }
    }

    private static Stat stat(String name, List<Pick> ps) {
        return new Stat(name, ps.size(), ps.stream().mapToDouble(Pick::won).average().orElse(0),
            ps.stream().mapToDouble(Pick::prob).average().orElse(0));
    }

    private static int pct(double v) { return (int) Math.round(v * 100); }

    private static List<Stat> by(List<Pick> picks, java.util.function.Function<Pick, String> key) {
        return picks.stream().collect(Collectors.groupingBy(key, java.util.TreeMap::new, Collectors.toList()))
            .entrySet().stream().map(e -> stat(e.getKey(), e.getValue())).toList();
    }

    static String format(List<Pick> picks) {
        if (picks.isEmpty()) return "- No settled picks yet in the last " + DAYS + " days: follow SELECTION RULES as written.";
        List<String> out = new ArrayList<>();
        out.add("- Settled picks, last %d days: %d. Win rate counts a half win as half.".formatted(DAYS, picks.size()));
        for (Stat s : by(picks, p -> "rank " + p.rank())) {
            int gap = pct(s.claimed()) - pct(s.win());
            out.add("- %s: won %d%% of %d, you said %d%%%s.".formatted(s.name(), pct(s.win()), s.n(), pct(s.claimed()),
                gap >= 3 ? " -> you were %d points too sure: lower your probabilities".formatted(gap)
                    : gap <= -3 ? " -> you were %d points too cautious".formatted(-gap) : " -> well calibrated"));
        }
        List<Stat> sides = by(picks, Pick::side), bands = by(picks, p -> "price " + priceBand(p.price())),
            types = by(picks, Pick::type);
        out.add("- By market and side: " + join(sides));
        out.add("- By price: " + join(bands));
        out.add("- By prediction type: " + join(types));
        List<Stat> groups = new ArrayList<>(sides);
        groups.addAll(bands);
        List<Stat> favour = groups.stream().filter(s -> s.n() >= MIN_GROUP && s.win() >= 0.60).toList();
        List<Stat> avoid = groups.stream().filter(s -> s.n() >= MIN_GROUP && s.win() < 0.45).toList();
        out.add("- FAVOUR (won 60%% or more, at least %d picks): %s".formatted(MIN_GROUP, favour.isEmpty() ? "none yet" : join(favour)));
        out.add("- AVOID (won under 45%%, at least %d picks): %s".formatted(MIN_GROUP, avoid.isEmpty() ? "none yet" : join(avoid)));
        return String.join("\n", out);
    }

    private static String join(List<Stat> stats) {
        return stats.stream().map(Stat::line).collect(Collectors.joining(" · "));
    }
}
