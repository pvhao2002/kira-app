package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.util.OddConverter;

public enum OddsLineMovement {
    UP,
    DOWN,
    FLAT;

    private static final double FLAT_EPSILON = 1e-6;

    public static OddsLineMovement fromLines(String openLine, String prematchLine) {
        if (openLine == null || prematchLine == null || openLine.isBlank() || prematchLine.isBlank()) {
            throw new IllegalArgumentException("open and pre-match lines are required");
        }
        double openValue = OddConverter.convertLine(openLine);
        double prematchValue = OddConverter.convertLine(prematchLine);
        double delta = prematchValue - openValue;
        if (Math.abs(delta) < FLAT_EPSILON) {
            return FLAT;
        }
        return delta > 0 ? UP : DOWN;
    }

    public static OddsLineMovement fromHdcLines(String openLine, String prematchLine) {
        return fromLines(homeHalf(openLine), homeHalf(prematchLine));
    }

    public static String homeHalf(String hdcLine) {
        if (hdcLine == null || !hdcLine.contains("#")) {
            return hdcLine;
        }
        return hdcLine.split("#")[0];
    }
}
