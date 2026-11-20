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
import java.time.Instant;
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

    private static final Instant NOW = Instant.parse("2026-11-20T12:00:00Z");

    private static PredictionRequest timed(String type, String startTime, String predictedAt, String capturedAt) {
        OddsInput o = new OddsInput("o1", "OU", "PRE_MATCH", null, new BigDecimal("2.5"), null, null, null, null, TWO, TWO,
            null, null, null, capturedAt == null ? null : Instant.parse(capturedAt), null);
        return new PredictionRequest(null, null,
            new MatchInfo(null, null, "A", "B", startTime == null ? null : Instant.parse(startTime), null), type,
            predictedAt == null ? null : Instant.parse(predictedAt), "LIVE".equals(type) ? 30 : null,
            "LIVE".equals(type) ? new Pair(0, 0) : null, null, List.of(o), null, null, List.of(pick("o1", 1)),
            new CorrectScoreInput(1, 1, null), null);
    }

    private static Map<String, String> errorsAt(PredictionRequest r) {
        return assertThrows(ApiException.class, () -> PredictionValidator.validate(r, NOW)).getFieldErrors();
    }

    @Test
    void futurePredictedAtIsRejected() {
        assertTrue(errorsAt(timed("LIVE", null, "2036-11-20T12:00:00Z", null)).containsKey("predictedAt"));
        assertDoesNotThrow(() -> PredictionValidator.validate(timed("LIVE", null, "2026-11-20T12:04:00Z", null), NOW));
    }

    @Test
    void preMatchPredictionMustNotBeAfterKickOff() {
        assertTrue(errorsAt(timed("PRE_MATCH", "2026-11-20T10:00:00Z", "2026-11-20T11:00:00Z", null)).containsKey("predictedAt"));
        // Absent predictedAt means "now": a PRE_MATCH for a match that already kicked off is refused too.
        assertTrue(errorsAt(timed("PRE_MATCH", "2026-11-20T10:00:00Z", null, null)).containsKey("predictedAt"));
        assertDoesNotThrow(() -> PredictionValidator.validate(timed("PRE_MATCH", "2026-11-20T15:00:00Z", null, null), NOW));
    }

    @Test
    void kickOffOutsideTheWindowIsRejected() {
        assertTrue(errorsAt(timed("PRE_MATCH", "+10000-01-01T00:00:00Z", null, null)).containsKey("match.startTime"));
        assertTrue(errorsAt(timed("LIVE", "0001-01-01T00:00:00Z", null, null)).containsKey("match.startTime"));
    }

    @Test
    void futureCapturedAtIsRejected() {
        assertTrue(errorsAt(timed("LIVE", null, null, "2026-11-21T00:00:00Z")).containsKey("odds[0].capturedAt"));
    }

    private static PredictionRequest teams(String home, String away) {
        return new PredictionRequest(null, null, new MatchInfo(null, null, home, away, null, null), "PRE_MATCH", null,
            null, null, null, List.of(total("o1", TWO, null)), null, null, List.of(pick("o1", 1)),
            new CorrectScoreInput(1, 1, null), null);
    }

    @Test
    void invisibleTeamNamesAreBlank() {
        Map<String, String> errors = errorsAt(teams("​​", " "));
        assertTrue(errors.containsKey("match.homeTeam"));
        assertTrue(errors.containsKey("match.awayTeam"));
    }

    @Test
    void aTeamCannotPlayItself() {
        assertTrue(errorsAt(teams("Arsenal", " arsenal ")).containsKey("match.awayTeam"));
        assertDoesNotThrow(() -> PredictionValidator.validate(teams("Arsenal", "Chelsea"), NOW));
    }

    @Test
    void identicalPicksAreRejected() {
        // Two snapshots of the same OU 2.5 line: picking OVER on both is the same bet twice.
        var sameLine = request("PRE_MATCH", null, null,
            List.of(total("o1", TWO, null), total("o2", new BigDecimal("1.95"), null)),
            List.of(pick("o1", 1), pick("o2", 2)), new CorrectScoreInput(1, 1, null));
        assertTrue(errorsAt(sameLine).containsKey("picks[1]"));

        var sameRef = request("PRE_MATCH", null, null, List.of(total("o1", TWO, null)),
            List.of(pick("o1", 1), pick("o1", 2)), new CorrectScoreInput(1, 1, null));
        assertTrue(errorsAt(sameRef).containsKey("picks[1]"));

        var otherSide = request("PRE_MATCH", null, null, List.of(total("o1", TWO, null)),
            List.of(pick("o1", 1), new PickInput("o1", "OU", "UNDER", new BigDecimal("0.4"), 2)), new CorrectScoreInput(1, 1, null));
        assertDoesNotThrow(() -> PredictionValidator.validate(otherSide, NOW));
    }

    @Test
    void finalScoreCannotBeBelowCurrentScore() {
        var r = request("LIVE", 60, new Pair(2, 0), List.of(total("o1", TWO, null)), List.of(pick("o1", 1)),
            new CorrectScoreInput(1, 1, null));
        assertTrue(errorsOf(r).containsKey("correctScore"));
    }
}
