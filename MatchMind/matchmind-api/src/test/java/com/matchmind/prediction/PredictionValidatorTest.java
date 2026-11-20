package com.matchmind.prediction;

import com.matchmind.external.ExternalDtos.CorrectScoreInput;
import com.matchmind.external.ExternalDtos.MatchInfo;
import com.matchmind.external.ExternalDtos.OddsInput;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.external.ExternalDtos.PickInput;
import com.matchmind.external.ExternalDtos.PredictionRequest;
import com.matchmind.shared.ApiException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PredictionValidatorTest {
    private static final BigDecimal TWO = new BigDecimal("2.00");

    private static OddsInput total(String ref, BigDecimal over, BigDecimal home) {
        return new OddsInput(ref, "OU", "PRE_MATCH", null, new BigDecimal("2.5"), null, home, null, null, over, TWO,
            null, null, null, null, null);
    }

    private static PredictionRequest request(String type, Integer minute, Pair current, List<OddsInput> odds,
                                             List<PickInput> picks, CorrectScoreInput cs) {
        return new PredictionRequest(null, null, new MatchInfo(null, null, "A", "B", null, null), type, null, minute,
            current, null, odds, null, null, picks, cs, null);
    }

    private static PickInput pick(String ref, int rank) {
        return new PickInput(ref, "OU", "OVER", new BigDecimal("0.6"), rank);
    }

    private static Map<String, String> errorsOf(PredictionRequest r) {
        return assertThrows(ApiException.class, () -> PredictionValidator.validate(r)).getFieldErrors();
    }

    @Test
    void validPreMatchPasses() {
        var r = request("PRE_MATCH", null, null, List.of(total("o1", TWO, null)), List.of(pick("o1", 1)),
            new CorrectScoreInput(1, 1, null));
        assertDoesNotThrow(() -> PredictionValidator.validate(r));
    }

    @Test
    void collectsAllProblemsTogether() {
        var r = request("LIVE", null, null, List.of(total("o1", TWO, TWO), total("o1", TWO, null)),
            List.of(pick("o1", 1), pick("missing", 1)), new CorrectScoreInput(1, 1, null));
        Map<String, String> errors = errorsOf(r);
        assertTrue(errors.containsKey("matchMinute"));
        assertTrue(errors.containsKey("currentScore"));
        assertTrue(errors.containsKey("odds[0].homeOdds"), "price field foreign to the market is rejected");
        assertTrue(errors.containsKey("odds[1].ref"), "duplicate ref");
        assertTrue(errors.containsKey("picks[1].rank"), "duplicate rank");
        assertEquals("unknown odds ref 'missing'", errors.get("picks[1].oddsRef"));
    }

    @Test
    void finalScoreCannotBeBelowCurrentScore() {
        var r = request("LIVE", 60, new Pair(2, 0), List.of(total("o1", TWO, null)), List.of(pick("o1", 1)),
            new CorrectScoreInput(1, 1, null));
        assertTrue(errorsOf(r).containsKey("correctScore"));
    }
}
