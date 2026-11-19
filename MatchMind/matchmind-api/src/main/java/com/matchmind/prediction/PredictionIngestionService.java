package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.matchmind.external.ExternalDtos.CorrectScoreInput;
import com.matchmind.external.ExternalDtos.OddsInput;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.external.ExternalDtos.PickInput;
import com.matchmind.external.ExternalDtos.PickRef;
import com.matchmind.external.ExternalDtos.ModelRef;
import com.matchmind.external.ExternalDtos.PredictionRequest;
import com.matchmind.external.ExternalDtos.PredictionResponse;
import com.matchmind.external.ExternalDtos.SimulationInput;
import com.matchmind.external.ExternalDtos.StatsInput;
import com.matchmind.match.Match;
import com.matchmind.match.MatchRepository;
import com.matchmind.model.AiModel;
import com.matchmind.model.AiModelRepository;
import com.matchmind.settlement.SettlementEngine;
import com.matchmind.shared.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * POST /api/v1/external/predictions. One atomic transaction: validate, idempotency check, upsert match, resolve model,
 * insert prediction + odds + stats + simulation + picks + correct score. Retries with the same eventId and the same
 * body return the original ids; the same eventId with a different body is rejected.
 */
@Service
@RequiredArgsConstructor
public class PredictionIngestionService {
    /** The prompt asks models for 1000 Monte Carlo iterations; assumed when a payload omits the count. */
    static final int DEFAULT_SIMULATION_COUNT = 1000;
    static final String UNKNOWN_LEAGUE = "Unknown league";
    /** A screenshot of the same teams within this time of a known match is that match. */
    private static final Duration SAME_MATCH_WINDOW = Duration.ofHours(12);
    private static final int HALF_TIME_BREAK_MINUTES = 15;

    private final PredictionRepository predictions;
    private final PredictionOddsRepository oddsRepo;
    private final PredictionStatsRepository statsRepo;
    private final PredictionSimulationRepository simRepo;
    private final PredictionPickRepository pickRepo;
    private final PredictionCorrectScoreRepository scoreRepo;
    private final MatchRepository matches;
    private final AiModelRepository models;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    @Transactional
    public PredictionResponse ingest(UUID providerId, ModelRef modelRef, PredictionRequest r, JsonNode rawPayload) {
        validate(r);
        String hash = payloadHash(rawPayload);
        String eventId = eventIdOf(r, hash);
        Optional<Prediction> existing = predictions.findByProviderIdAndExternalEventId(providerId, eventId);
        if (existing.isPresent()) return duplicate(existing.get(), hash);

        AiModel model = model(providerId, modelRef);
        Instant predictedAt = r.predictedAt() != null ? r.predictedAt() : Instant.now();
        Match match = upsertMatch(providerId, r, predictedAt);
        Prediction p = predictions.saveAndFlush(
            prediction(providerId, match.getId(), model.getId(), r, eventId, predictedAt, rawPayload, hash));

        Map<String, PredictionOdds> oddsByRef = new LinkedHashMap<>();
        for (OddsInput in : r.odds()) oddsByRef.put(in.ref(), oddsRepo.save(odds(p.getId(), in)));
        if (r.stats() != null) statsRepo.save(stats(p.getId(), r.stats()));
        if (r.simulation() != null) simRepo.save(simulation(p.getId(), r.simulation()));
        oddsRepo.flush();

        List<PickRef> pickRefs = new ArrayList<>();
        for (PickInput in : r.picks()) {
            PredictionPick pick = pickRepo.save(pick(p.getId(), oddsByRef.get(in.oddsRef()).getId(), in));
            pickRefs.add(new PickRef(pick.getId(), in.rank(), in.market(), in.pick(), pick.getOddsId()));
        }
        scoreRepo.save(correctScore(p.getId(), r.correctScore()));
        pickRepo.flush();

        Map<String, UUID> oddsIds = new LinkedHashMap<>();
        oddsByRef.forEach((ref, o) -> oddsIds.put(ref, o.getId()));
        return new PredictionResponse(p.getId(), match.getId(), match.getExternalMatchId(), false, pickRefs, oddsIds);
    }

    /** Without an eventId the payload itself is the idempotency key, so resending the same JSON is a duplicate. */
    static String eventIdOf(PredictionRequest r, String payloadHash) {
        return r.eventId() != null ? r.eventId() : "auto-" + payloadHash.substring(0, 32);
    }

    /**
     * Models are created on first use. Inside this transaction a concurrent first insert of the same model makes
     * ON CONFLICT wait for it, so the second lookup finds that row; a rejected prediction rolls its new model back.
     */
    private AiModel model(UUID providerId, ModelRef ref) {
        return models.findByProviderIdAndNameAndVersion(providerId, ref.name(), ref.version()).orElseGet(() -> {
            models.insertIfMissing(providerId, ref.name(), ref.version());
            return models.findByProviderIdAndNameAndVersion(providerId, ref.name(), ref.version()).orElseThrow();
        });
    }

    /** Used after a concurrent insert of the same eventId lost the race on the unique key. */
    @Transactional(readOnly = true)
    public Optional<PredictionResponse> findDuplicate(UUID providerId, PredictionRequest r, JsonNode rawPayload) {
        String hash = payloadHash(rawPayload);
        return predictions.findByProviderIdAndExternalEventId(providerId, eventIdOf(r, hash)).map(p -> duplicate(p, hash));
    }

    private PredictionResponse duplicate(Prediction p, String hash) {
        if (!p.getPayloadHash().equals(hash)) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_ID_REUSED",
                "eventId was already used for a different prediction payload; send a new eventId");
        }
        List<PickRef> refs = pickRepo.findByPredictionIdOrderByPickRankAsc(p.getId()).stream()
            .map(k -> new PickRef(k.getId(), k.getPickRank(), k.getMarket(), k.getPick(), k.getOddsId())).toList();
        Map<String, UUID> oddsIds = new LinkedHashMap<>();
        oddsRepo.findByPredictionIdOrderByMarketAscOddsStageAscSnapshotOrderAsc(p.getId())
            .forEach(o -> oddsIds.put(o.getOddsRef(), o.getId()));
        String externalMatchId = matches.findById(p.getMatchId()).map(Match::getExternalMatchId).orElse(null);
        return new PredictionResponse(p.getId(), p.getMatchId(), externalMatchId, true, refs, oddsIds);
    }

    /**
     * Insert-if-absent then lock, so concurrent callbacks for a new match never collide. Descriptive fields follow
     * the latest callback; status is only taken from predictions until the results API has spoken, and results
     * (scores) are never touched here.
     */
    private Match upsertMatch(UUID providerId, PredictionRequest r, Instant predictedAt) {
        var m = r.match();
        String status = m.status() != null ? m.status() : ("LIVE".equals(r.predictionType()) ? "LIVE" : "SCHEDULED");
        String home = m.homeTeam().trim();
        String away = m.awayTeam().trim();
        String league = m.league() == null || m.league().isBlank() ? null : m.league().trim();
        Instant start = m.startTime() != null ? m.startTime() : estimatedKickOff(r.matchMinute(), predictedAt);
        String externalId = m.externalMatchId() != null ? m.externalMatchId() : externalIdByTeams(providerId, home, away, start);
        jdbc.update("""
            INSERT INTO matches (provider_id, external_match_id, league, home_team, away_team, start_time, status)
            VALUES (:provider, :ext, :league, :home, :away, :start, :status)
            ON CONFLICT (provider_id, external_match_id) DO NOTHING
            """, new MapSqlParameterSource().addValue("provider", providerId).addValue("ext", externalId)
            .addValue("league", league != null ? league : UNKNOWN_LEAGUE).addValue("home", home).addValue("away", away)
            .addValue("start", Timestamp.from(start)).addValue("status", status));
        Match match = matches.lockByProviderAndExternalId(providerId, externalId).orElseThrow();
        // Picks made after the result is known would never settle and could game the win rate.
        if (match.getResultUpdatedAt() != null && List.of("FINISHED", "CANCELLED").contains(match.getStatus())) {
            throw ApiException.conflict("MATCH_ALREADY_FINAL",
                "This match is already " + match.getStatus() + "; predictions are no longer accepted for it");
        }
        // Missing details never overwrite known ones: an estimated kick-off only applies to a new match.
        if (league != null) match.setLeague(league);
        match.setHomeTeam(home);
        match.setAwayTeam(away);
        if (m.startTime() != null) match.setStartTime(m.startTime());
        boolean resultKnown = match.getResultUpdatedAt() != null
            || List.of("FINISHED", "CANCELLED", "POSTPONED").contains(match.getStatus());
        if (!resultKnown) match.setStatus(status);
        return matches.saveAndFlush(match);
    }

    /**
     * A LIVE screen shows the minute, not the kick-off.
     * ponytail: assumes a 15-minute half-time and no stoppage time; good to a few minutes, enough to find the match.
     */
    static Instant estimatedKickOff(Integer matchMinute, Instant predictedAt) {
        if (matchMinute == null) return predictedAt;
        int elapsed = matchMinute + (matchMinute > 45 ? HALF_TIME_BREAK_MINUTES : 0);
        return predictedAt.minus(Duration.ofMinutes(elapsed)).truncatedTo(ChronoUnit.MINUTES);
    }

    /**
     * The match this provider already has for these teams around that kick-off; otherwise a stable id for a new one.
     * Same teams on the same UTC day give the same id, so concurrent first screenshots end up on one match.
     */
    private String externalIdByTeams(UUID providerId, String home, String away, Instant start) {
        List<String> near = jdbc.queryForList("""
            SELECT external_match_id FROM matches
            WHERE provider_id = :provider AND lower(home_team) = lower(:home) AND lower(away_team) = lower(:away)
              AND start_time BETWEEN :from AND :to
            ORDER BY abs(extract(epoch FROM start_time - :start)) LIMIT 1
            """, new MapSqlParameterSource().addValue("provider", providerId).addValue("home", home).addValue("away", away)
            .addValue("from", start.minus(SAME_MATCH_WINDOW).atOffset(ZoneOffset.UTC))
            .addValue("to", start.plus(SAME_MATCH_WINDOW).atOffset(ZoneOffset.UTC))
            .addValue("start", start.atOffset(ZoneOffset.UTC)), String.class);
        if (!near.isEmpty()) return near.getFirst();
        String key = home.toLowerCase(Locale.ROOT) + "|" + away.toLowerCase(Locale.ROOT) + "|" + LocalDate.ofInstant(start, ZoneOffset.UTC);
        return "auto-" + sha256Hex(key.getBytes(java.nio.charset.StandardCharsets.UTF_8)).substring(0, 24);
    }

    /** Cross-field rules Bean Validation cannot express. All problems are reported together. */
    void validate(PredictionRequest r) {
        Map<String, String> errors = new LinkedHashMap<>();
        boolean live = "LIVE".equals(r.predictionType());
        if (live && r.matchMinute() == null) errors.put("matchMinute", "required for LIVE predictions");
        if (live && r.currentScore() == null) errors.put("currentScore", "required for LIVE predictions");

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
            var it = node.fields();
            if (node.isArray()) for (int i = 0; i < node.size(); i++) checkProbabilities(node.get(i), path + "[" + i + "]", errors);
            else while (it.hasNext()) {
                var e = it.next();
                checkProbabilities(e.getValue(), path + "." + e.getKey(), errors);
            }
        }
    }

    private static Prediction prediction(UUID providerId, UUID matchId, UUID modelId, PredictionRequest r, String eventId,
                                         Instant predictedAt, JsonNode rawPayload, String hash) {
        Prediction p = new Prediction();
        p.setProviderId(providerId);
        p.setMatchId(matchId);
        p.setAiModelId(modelId);
        p.setExternalEventId(eventId);
        p.setPredictionType(r.predictionType());
        p.setMatchMinute(r.matchMinute());
        if (r.currentScore() != null) {
            p.setCurrentHomeScore(r.currentScore().home());
            p.setCurrentAwayScore(r.currentScore().away());
        }
        if (r.currentCorners() != null) {
            p.setCurrentHomeCorners(r.currentCorners().home());
            p.setCurrentAwayCorners(r.currentCorners().away());
        }
        p.setPredictedAt(predictedAt);
        p.setPayload(rawPayload);
        p.setPayloadHash(hash);
        p.setMetadata(r.metadata());
        return p;
    }

    private static PredictionPick pick(UUID predictionId, UUID oddsId, PickInput in) {
        PredictionPick pick = new PredictionPick();
        pick.setPredictionId(predictionId);
        pick.setOddsId(oddsId);
        pick.setMarket(in.market());
        pick.setPick(in.pick());
        pick.setProbability(in.probability());
        pick.setPickRank(in.rank());
        return pick;
    }

    private static PredictionCorrectScore correctScore(UUID predictionId, CorrectScoreInput cs) {
        PredictionCorrectScore score = new PredictionCorrectScore();
        score.setPredictionId(predictionId);
        score.setHomeScore(cs.home());
        score.setAwayScore(cs.away());
        score.setProbability(cs.probability());
        return score;
    }

    private static PredictionOdds odds(UUID predictionId, OddsInput in) {
        PredictionOdds o = new PredictionOdds();
        o.setPredictionId(predictionId);
        o.setOddsRef(in.ref());
        o.setMarket(in.market());
        o.setOddsStage(in.stage());
        o.setSnapshotOrder(in.snapshotOrder() == null ? 1 : in.snapshotOrder());
        o.setLine(in.line());
        o.setLineDisplay(in.lineDisplay());
        o.setHomeOdds(in.homeOdds());
        o.setAwayOdds(in.awayOdds());
        o.setDrawOdds(in.drawOdds());
        o.setOverOdds(in.overOdds());
        o.setUnderOdds(in.underOdds());
        o.setSettlementBasis(in.settlementBasis() == null ? "FULL_MATCH" : in.settlementBasis());
        if (in.scoreAtCapture() != null) {
            o.setHomeScoreAtCapture(in.scoreAtCapture().home());
            o.setAwayScoreAtCapture(in.scoreAtCapture().away());
        }
        if (in.cornersAtCapture() != null) {
            o.setHomeCornersAtCapture(in.cornersAtCapture().home());
            o.setAwayCornersAtCapture(in.cornersAtCapture().away());
        }
        o.setCapturedAt(in.capturedAt());
        o.setExtra(in.extra());
        return o;
    }

    private static PredictionStats stats(UUID predictionId, StatsInput in) {
        PredictionStats s = new PredictionStats();
        s.setPredictionId(predictionId);
        if (in.possession() != null) {
            s.setPossessionHome(in.possession().home());
            s.setPossessionAway(in.possession().away());
        }
        if (in.shots() != null) {
            s.setShotsHome(in.shots().home());
            s.setShotsAway(in.shots().away());
        }
        if (in.shotsOnTarget() != null) {
            s.setShotsOnTargetHome(in.shotsOnTarget().home());
            s.setShotsOnTargetAway(in.shotsOnTarget().away());
        }
        if (in.shotsOffTarget() != null) {
            s.setShotsOffTargetHome(in.shotsOffTarget().home());
            s.setShotsOffTargetAway(in.shotsOffTarget().away());
        }
        if (in.corners() != null) {
            s.setCornersHome(in.corners().home());
            s.setCornersAway(in.corners().away());
        }
        if (in.yellowCards() != null) {
            s.setYellowCardsHome(in.yellowCards().home());
            s.setYellowCardsAway(in.yellowCards().away());
        }
        if (in.redCards() != null) {
            s.setRedCardsHome(in.redCards().home());
            s.setRedCardsAway(in.redCards().away());
        }
        s.setExtra(in.extra());
        return s;
    }

    private static PredictionSimulation simulation(UUID predictionId, SimulationInput in) {
        PredictionSimulation s = new PredictionSimulation();
        s.setPredictionId(predictionId);
        s.setMethod(in.method() == null ? "MONTE_CARLO" : in.method());
        s.setSimulationCount(in.simulationCount() == null ? DEFAULT_SIMULATION_COUNT : in.simulationCount());
        s.setRandomSeed(in.randomSeed());
        if (in.expectedRemainingGoals() != null) {
            s.setExpectedRemainingHomeGoals(in.expectedRemainingGoals().home());
            s.setExpectedRemainingAwayGoals(in.expectedRemainingGoals().away());
        }
        if (in.expectedRemainingCorners() != null) {
            s.setExpectedRemainingHomeCorners(in.expectedRemainingCorners().home());
            s.setExpectedRemainingAwayCorners(in.expectedRemainingCorners().away());
        }
        s.setAlgorithmVersion(in.algorithmVersion());
        s.setParameters(in.parameters());
        s.setProbabilities(in.probabilities());
        s.setCorrectScoreDistribution(in.correctScoreDistribution());
        return s;
    }

    /** Hash of the canonical (key-sorted) JSON, so a retry with reordered keys or whitespace is still a duplicate. */
    String payloadHash(JsonNode payload) {
        try {
            Object plain = json.treeToValue(payload, Object.class);
            return sha256Hex(json.writer().with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsBytes(plain));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
