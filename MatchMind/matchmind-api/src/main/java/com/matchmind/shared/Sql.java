package com.matchmind.shared;

import org.springframework.jdbc.core.ColumnMapRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Read-model helpers. Report/list queries return rows keyed by quoted camelCase SQL aliases, so they serialize
 * straight to JSON without an entity or a hand-written mapper per report.
 */
public final class Sql {
    /** Row as an ordered map; timestamps become Instants (ISO-8601 UTC in JSON). */
    public static final RowMapper<Map<String, Object>> ROW = new ColumnMapRowMapper() {
        @Override
        protected Object getColumnValue(ResultSet rs, int index) throws SQLException {
            Object v = super.getColumnValue(rs, index);
            return v instanceof Timestamp t ? t.toInstant() : v;
        }
    };

    /** Selected decimal price for the pick column {@code pk.pick} on odds alias {@code o}. */
    public static final String PRICE = "CASE pk.pick WHEN 'HOME' THEN o.home_odds WHEN 'AWAY' THEN o.away_odds "
        + "WHEN 'DRAW' THEN o.draw_odds WHEN 'OVER' THEN o.over_odds ELSE o.under_odds END";

    /**
     * The bookmaker's probability of pick {@code pk} without its margin: 1 / price over the sum of 1 / price of every
     * selection of the same snapshot {@code o}. NUMERIC throughout; the schema keeps every price above 1.
     */
    public static final String MARKET_PROBABILITY = "((1 / (" + PRICE + ")) / CASE o.market"
        + " WHEN '1X2' THEN 1 / o.home_odds + 1 / o.draw_odds + 1 / o.away_odds"
        + " WHEN 'AH' THEN 1 / o.home_odds + 1 / o.away_odds WHEN 'CORNER_AH' THEN 1 / o.home_odds + 1 / o.away_odds"
        + " ELSE 1 / o.over_odds + 1 / o.under_odds END)";
    /**
     * The pick's edge over the market in the prediction prompt's unit (SELECTION RULES b, V45): (stated probability -
     * {@link #MARKET_PROBABILITY}) x price, which is the stated expected return minus the market's, since the prompt
     * states probability = (1 + expected return) / price.
     */
    public static final String EDGE = "(pk.probability - " + MARKET_PROBABILITY + ") * (" + PRICE + ")";

    /**
     * Prediction alias p -> its effective model, alias am: the model it was merged into (V24), else itself. Reports group
     * on am, so a merged model's predictions roll up into the surviving model; am0 is the model the agent named.
     */
    public static final String EFFECTIVE_MODEL_JOIN =
        " JOIN ai_models am0 ON am0.id = p.ai_model_id JOIN ai_models am ON am.id = COALESCE(am0.merged_into_id, am0.id) ";
    /** The name to show for effective model alias am: the admin's display name, else the provider-supplied one. */
    public static final String MODEL_NAME = "COALESCE(am.display_name, am.name)";

    private Sql() {
    }

    /** AND-joined WHERE clause with named parameters; a condition is added only when its value is present. */
    public static final class Where {
        private final List<String> parts = new ArrayList<>();
        public final MapSqlParameterSource params = new MapSqlParameterSource();

        public Where and(String condition, String name, Object value) {
            if (value == null || (value instanceof String s && s.isBlank())) return this;
            parts.add(condition);
            params.addValue(name, value instanceof Instant i ? Timestamp.from(i) : value);
            return this;
        }

        public Where and(String condition) {
            parts.add(condition);
            return this;
        }

        public String sql() {
            return parts.isEmpty() ? "" : " WHERE " + String.join(" AND ", parts) + " ";
        }

        public String andSql() {
            return parts.isEmpty() ? "" : " AND " + String.join(" AND ", parts) + " ";
        }
    }
}
