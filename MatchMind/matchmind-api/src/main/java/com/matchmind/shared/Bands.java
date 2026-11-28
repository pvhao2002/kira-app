package com.matchmind.shared;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Named ranges that reports and the prompt's TRACK RECORD group picks by, defined once and rendered as a SQL CASE, so
 * both speak of the same "price 1.66-1.80" or "edge above 0.15". The bounds follow the prediction prompt's SELECTION
 * RULES (V45): the price window "above 1.65 and at most 1.90" and the gate "edge >= 0.10".
 */
public final class Bands {
    /** {@code test} is the comparison applied to the expression, e.g. {@code "<= 1.65"}; null on the last band (ELSE). */
    public record Band(String test, String label) {
    }

    public static final List<Band> PRICE = List.of(new Band("<= 1.65", "1.65 or lower"), new Band("<= 1.80", "1.66-1.80"),
        new Band("<= 1.90", "1.81-1.90"), new Band("<= 2.05", "1.91-2.05"), new Band(null, "above 2.05"));
    /** {@link Sql#EDGE}: (stated - market) x price, the expected return over the market's, as SELECTION RULES state it. */
    public static final List<Band> EDGE = List.of(new Band("<= 0", "0 or below"), new Band("<= 0.05", "0 to 0.05"),
        new Band("<= 0.10", "0.05 to 0.10"), new Band("<= 0.15", "0.10 to 0.15"), new Band(null, "above 0.15"));
    public static final List<Band> PROBABILITY = List.of(new Band("< 0.55", "below 0.55"), new Band("< 0.60", "0.55-0.59"),
        new Band("< 0.65", "0.60-0.64"), new Band("< 0.70", "0.65-0.69"), new Band(null, "0.70 or more"));

    private Bands() {
    }

    /** CASE giving the label of the band {@code expr} falls in. Bounds and labels are constants, never user input. */
    public static String sql(String expr, List<Band> bands) {
        String whens = bands.stream().filter(b -> b.test() != null)
            .map(b -> "WHEN (" + expr + ") " + b.test() + " THEN '" + b.label() + "'").collect(Collectors.joining(" "));
        return "CASE " + whens + " ELSE '" + bands.getLast().label() + "' END";
    }
}
