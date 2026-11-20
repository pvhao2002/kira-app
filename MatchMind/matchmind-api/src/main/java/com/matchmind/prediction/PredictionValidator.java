package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.external.ExternalDtos.CorrectScoreInput;
import com.matchmind.external.ExternalDtos.OddsInput;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.external.ExternalDtos.PickInput;
import com.matchmind.external.ExternalDtos.PredictionRequest;
import com.matchmind.external.ExternalDtos.SimulationInput;
import com.matchmind.settlement.SettlementEngine;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.TimeRules;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pure cross-field validation of a prediction payload; no I/O, so it is unit-testable without a database. */
final class PredictionValidator {
    private PredictionValidator() {}

    /** Cross-field rules Bean Validation cannot express. All problems are reported together. */
    static void validate(PredictionRequest r) {
        validate(r, Instant.now());
    }

    static void validate(PredictionRequest r, Instant now) {
        Map<String, String> errors = new LinkedHashMap<>();
        boolean live = "LIVE".equals(r.predictionType());
        if (live && r.matchMinute() == null) errors.put("matchMinute", "required for LIVE predictions");
        if (live && r.currentScore() == null) errors.put("currentScore", "required for LIVE predictions");
        validateTimes(r, live, now, errors);

        Map<String, OddsInput> oddsByRef = validateOdds(r.odds(), live, errors);
        validatePicks(r.picks(), oddsByRef, errors);

        CorrectScoreInput cs = r.correctScore();
        Pair cur = r.currentScore();
        if (cs != null && cur != null && (cs.home() < cur.home() || cs.away() < cur.away())) {
            errors.put("correctScore", "the predicted FINAL score cannot be lower than the current score");
        }
        if (r.simulation() != null) validateSimulation(r.simulation(), errors);
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Prediction payload is invalid", errors);
        }
    }

    /** Shared time window, plus: a PRE_MATCH prediction (absent predictedAt = now) is made before kick-off. */
    private static void validateTimes(PredictionRequest r, boolean live, Instant now, Map<String, String> errors) {
        Instant start = r.match().startTime();
        TimeRules.checkKickOff(start, "match.startTime", now, errors);
        TimeRules.checkObserved(r.predictedAt(), "predictedAt", now, errors);
        for (int i = 0; i < r.odds().size(); i++) {
            TimeRules.checkObserved(r.odds().get(i).capturedAt(), "odds[" + i + "].capturedAt", now, errors);
        }
        Instant predictedAt = r.predictedAt() != null ? r.predictedAt() : now;
        if (!live && start != null && predictedAt.isAfter(start) && !errors.containsKey("predictedAt")) {
            errors.put("predictedAt", "a PRE_MATCH prediction must be made before match.startTime (absent predictedAt = now)");
        }
    }

    private static Map<String, OddsInput> validateOdds(List<OddsInput> odds, boolean live, Map<String, String> errors) {
        Map<String, OddsInput> byRef = new LinkedHashMap<>();
        for (int i = 0; i < odds.size(); i++) {
            OddsInput o = odds.get(i);
            String f = "odds[" + i + "].";
            if (byRef.put(o.ref(), o) != null) errors.put(f + "ref", "duplicate odds ref '" + o.ref() + "'");
            if (!live && "LIVE".equals(o.stage())) errors.put(f + "stage", "LIVE odds are not allowed in a PRE_MATCH prediction");
            validatePrices(o, f, errors);
            if (o.settlementBasis() == null && "LIVE".equals(o.stage())) {
                errors.put(f + "settlementBasis", "required for LIVE odds (FULL_MATCH or REMAINING_MATCH)");
            }
            if ("1X2".equals(o.market()) && "REMAINING_MATCH".equals(o.settlementBasis())) {
                errors.put(f + "settlementBasis", "1X2 is always settled on the full match (FULL_MATCH)");
            } else if ("REMAINING_MATCH".equals(o.settlementBasis())) {
                boolean corner = o.market().startsWith("CORNER_");
                if (corner && o.cornersAtCapture() == null) errors.put(f + "cornersAtCapture", "required for REMAINING_MATCH corner odds");
                if (!corner && o.scoreAtCapture() == null) errors.put(f + "scoreAtCapture", "required for REMAINING_MATCH odds");
            }
        }
        return byRef;
    }

    private static void validatePicks(List<PickInput> picks, Map<String, OddsInput> oddsByRef, Map<String, String> errors) {
        Set<Integer> ranks = new HashSet<>();
        for (int i = 0; i < picks.size(); i++) {
            PickInput p = picks.get(i);
            String f = "picks[" + i + "].";
            if (!ranks.add(p.rank())) errors.put(f + "rank", "duplicate rank " + p.rank());
            OddsInput o = oddsByRef.get(p.oddsRef());
            if (o == null) {
                errors.put(f + "oddsRef", "unknown odds ref '" + p.oddsRef() + "'");
                continue;
            }
            if (!o.market().equals(p.market())) errors.put(f + "market", "pick market " + p.market() + " does not match odds market " + o.market());
            try {
                SettlementEngine.validatePick(p.market(), p.pick());
            } catch (IllegalArgumentException e) {
                errors.put(f + "pick", e.getMessage());
            }
        }
    }

    private static void validateSimulation(SimulationInput sim, Map<String, String> errors) {
        if (sim.probabilities() != null) checkProbabilities(sim.probabilities(), "simulation.probabilities", errors);
        JsonNode dist = sim.correctScoreDistribution();
        if (dist == null) return;
        if (!dist.isArray()) {
            errors.put("simulation.correctScoreDistribution", "must be an array of {home, away, probability}");
            return;
        }
        for (int i = 0; i < dist.size(); i++) {
            JsonNode e = dist.get(i);
            String path = "simulation.correctScoreDistribution[" + i + "]";
            if (!isScore(e.path("home")) || !isScore(e.path("away")) || !e.path("probability").isNumber()) {
                errors.put(path, "must be {home >= 0, away >= 0, probability}");
            } else {
                checkProbabilities(e.get("probability"), path + ".probability", errors);
            }
        }
    }

    private static boolean isScore(JsonNode n) {
        return n.canConvertToInt() && n.asInt() >= 0;
    }

    /** Fields that do not belong to the market are rejected rather than silently dropped. */
    private static void validatePrices(OddsInput o, String f, Map<String, String> errors) {
        switch (o.market()) {
            case "1X2" -> {
                if (o.line() != null) errors.put(f + "line", "must be absent for 1X2");
                require(o.homeOdds(), f + "homeOdds", errors);
                require(o.drawOdds(), f + "drawOdds", errors);
                require(o.awayOdds(), f + "awayOdds", errors);
                forbid(o.overOdds(), f + "overOdds", errors);
                forbid(o.underOdds(), f + "underOdds", errors);
            }
            case "AH", "CORNER_AH" -> {
                checkLine(o.line(), f, false, errors);
                require(o.homeOdds(), f + "homeOdds", errors);
                require(o.awayOdds(), f + "awayOdds", errors);
                forbid(o.drawOdds(), f + "drawOdds", errors);
                forbid(o.overOdds(), f + "overOdds", errors);
                forbid(o.underOdds(), f + "underOdds", errors);
            }
            default -> {
                checkLine(o.line(), f, true, errors);
                require(o.overOdds(), f + "overOdds", errors);
                require(o.underOdds(), f + "underOdds", errors);
                forbid(o.homeOdds(), f + "homeOdds", errors);
                forbid(o.drawOdds(), f + "drawOdds", errors);
                forbid(o.awayOdds(), f + "awayOdds", errors);
            }
        }
    }

    private static void checkLine(BigDecimal line, String f, boolean total, Map<String, String> errors) {
        if (line == null) errors.put(f + "line", "required");
        else if (!SettlementEngine.isValidLine(line)) errors.put(f + "line", "must be a multiple of 0.25");
        else if (total && line.signum() < 0) errors.put(f + "line", "total line cannot be negative");
    }

    private static void require(Object v, String field, Map<String, String> errors) {
        if (v == null) errors.put(field, "required for this market");
    }

    private static void forbid(Object v, String field, Map<String, String> errors) {
        if (v != null) errors.put(field, "not allowed for this market");
    }

    private static void checkProbabilities(JsonNode node, String path, Map<String, String> errors) {
        if (node.isNumber()) {
            double v = node.asDouble();
            if (v < 0 || v > 1) errors.put(path, "probability must be between 0 and 1");
        } else if (node.isContainerNode()) {
            if (node.isArray()) for (int i = 0; i < node.size(); i++) checkProbabilities(node.get(i), path + "[" + i + "]", errors);
            else node.properties().forEach(e -> checkProbabilities(e.getValue(), path + "." + e.getKey(), errors));
        }
    }
}
