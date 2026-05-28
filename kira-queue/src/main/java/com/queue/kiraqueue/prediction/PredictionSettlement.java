package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.util.OddConverter;
import lombok.experimental.UtilityClass;

@UtilityClass
public class PredictionSettlement {

    private static final String HASH = "#";
    private static final double PUSH_EPSILON = 1e-6;

    public static PredictionOutcome settleHandicap(
            int homeGoals,
            int awayGoals,
            String prematchHdcLine,
            PredictionPick pick
    ) {
        if (pick == null || pick == PredictionPick.NONE || isBlank(prematchHdcLine)) {
            return PredictionOutcome.NONE;
        }
        if (pick != PredictionPick.HOME && pick != PredictionPick.AWAY) {
            return PredictionOutcome.NONE;
        }

        var hdcHome = OddConverter.convertLine(prematchHdcLine.split(HASH)[0]);
        double adjustedHome = homeGoals + hdcHome;
        double delta = adjustedHome - awayGoals;

        if (Math.abs(delta) < PUSH_EPSILON) {
            return PredictionOutcome.VOID;
        }
        if (pick == PredictionPick.HOME) {
            return delta > 0 ? PredictionOutcome.WIN : PredictionOutcome.LOSE;
        }
        return delta < 0 ? PredictionOutcome.WIN : PredictionOutcome.LOSE;
    }

    public static PredictionOutcome settleOverUnder(
            int homeGoals,
            int awayGoals,
            String prematchOuLine,
            PredictionPick pick
    ) {
        if (pick == null || pick == PredictionPick.NONE || isBlank(prematchOuLine)) {
            return PredictionOutcome.NONE;
        }
        if (pick != PredictionPick.OVER && pick != PredictionPick.UNDER) {
            return PredictionOutcome.NONE;
        }

        double total = homeGoals + awayGoals;
        double line = OddConverter.convertLine(prematchOuLine);
        double delta = total - line;

        if (Math.abs(delta) < PUSH_EPSILON) {
            return PredictionOutcome.VOID;
        }
        if (pick == PredictionPick.OVER) {
            return delta > 0 ? PredictionOutcome.WIN : PredictionOutcome.LOSE;
        }
        return delta < 0 ? PredictionOutcome.WIN : PredictionOutcome.LOSE;
    }

    public static PredictionPick parsePick(String pick) {
        if (pick == null || pick.isBlank()) {
            return PredictionPick.NONE;
        }
        try {
            return PredictionPick.valueOf(pick);
        } catch (IllegalArgumentException ex) {
            return PredictionPick.NONE;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
