package com.matchmind.settlement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalDtos.AiCalculation;
import com.matchmind.match.Match;
import com.matchmind.match.MatchRepository;
import com.matchmind.prediction.PredictionOdds;
import com.matchmind.prediction.PredictionOddsRepository;
import com.matchmind.prediction.PredictionPick;
import com.matchmind.prediction.PredictionPickRepository;
import com.matchmind.prediction.PredictionRepository;
import com.matchmind.settlement.SettlementEngine.Input;
import com.matchmind.settlement.SettlementEngine.Outcome;
import com.matchmind.settlement.SettlementEngine.Score;
import com.matchmind.shared.ApiException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Persists settlements produced by {@link SettlementEngine}. Rules:
 * <ul>
 *   <li>A pick that already has a current settlement is never silently overwritten.</li>
 *   <li>Changing a settlement requires an ADMIN recalculation or override; the old row is kept and superseded.</li>
 *   <li>External AI calculations are stored next to the authoritative result as advisory data only.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SettlementService {
    private final MatchRepository matches;
    private final PredictionRepository predictions;
    private final PredictionPickRepository picks;
    private final PredictionOddsRepository odds;
    private final PickResultRepository results;
    private final ObjectMapper json;
    private final NamedParameterJdbcTemplate jdbc;

    public record PickSettlement(UUID pickId, String market, String pick, String result, String status, String reason,
                                 String aiResult, Boolean aiAgrees) {
    }

    public record MatchSettlement(UUID matchId, String matchStatus, int settled, int alreadySettled, int pending,
                                  int needsReview, List<PickSettlement> picks) {
    }

    public record OverrideRequest(@NotBlank @Pattern(regexp = "WIN|LOSS|HALF_WIN|HALF_LOSS|PUSH|VOID") String result,
                                  @NotBlank @Size(max = 2000) String reason) {
    }

    public record RecalculateRequest(@NotBlank @Size(max = 2000) String reason) {
    }

    /** A settled pick whose match result changed afterwards and would now settle differently. */
    public record ReviewItem(UUID pickId, UUID predictionId, UUID matchId, String homeTeam, String awayTeam,
                             String matchStatus, String market, String pick, String currentResult, String newResult,
                             String reason, Instant settledAt) {
    }

    private static final String PENDING = "PENDING";
    private static final List<String> FINAL_STATUSES = List.of("FINISHED", "CANCELLED");

    /**
     * Settles every pending pick of the match. Already-settled picks are left untouched; when a fresh calculation
     * disagrees with them (e.g. after a corrected result) they are reported as needing admin review.
     */
    @Transactional
    public MatchSettlement settleMatch(UUID matchId, String source, UUID actor, List<AiCalculation> aiCalculations) {
        Match match = matches.lockById(matchId).orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "Match not found"));
        List<PredictionPick> matchPicks = picks.findByMatchId(matchId);
        Map<UUID, AiCalculation> claims = aiCalculations == null ? Map.of()
            : aiCalculations.stream().collect(Collectors.toMap(AiCalculation::pickId, Function.identity(), (a, b) -> b));
        var pickIds = matchPicks.stream().map(PredictionPick::getId).collect(Collectors.toSet());
        List<UUID> foreign = claims.keySet().stream().filter(id -> !pickIds.contains(id)).toList();
        if (!foreign.isEmpty()) {
            throw ApiException.unprocessable("PICK_NOT_IN_MATCH", "aiCalculations reference picks that do not belong to this match: " + foreign);
        }
        Map<UUID, PredictionOdds> oddsById = odds.findAllById(matchPicks.stream().map(PredictionPick::getOddsId).toList())
            .stream().collect(Collectors.toMap(PredictionOdds::getId, Function.identity()));

        Map<UUID, PickResult> currentByPick = results.findByPickIdInAndCurrentTrue(pickIds).stream()
            .collect(Collectors.toMap(PickResult::getPickId, Function.identity()));

        int settled = 0, already = 0, pending = 0, review = 0;
        List<PickSettlement> out = new ArrayList<>();
        List<PickResult> inserts = new ArrayList<>();
        for (PredictionPick pick : matchPicks) {
            PredictionOdds o = oddsById.get(pick.getOddsId());
            Outcome outcome = SettlementEngine.settle(input(pick, o, match));
            AiCalculation claim = claims.get(pick.getId());
            Boolean agrees = claim == null ? null : claim.result().equals(outcome.result());
            PickResult current = currentByPick.get(pick.getId());
            String status;
            String result = outcome.result();
            if (current != null && !PENDING.equals(current.getResult())) {
                already++;
                result = current.getResult();
                agrees = claim == null ? null : claim.result().equals(result);
                if (outcome.settled() && !outcome.result().equals(result)) {
                    review++;
                    status = "NEEDS_REVIEW";
                } else {
                    status = "ALREADY_SETTLED";
                }
            } else if (!outcome.settled()) {
                pending++;
                status = "PENDING";
            } else {
                settled++;
                status = "SETTLED";
                PickResult row = row(pick, o, outcome, source, actor, null, claim);
                if (current == null) inserts.add(row);
                else replace(Optional.of(current), () -> results.saveAndFlush(row)); // reopened earlier by an admin
            }
            out.add(new PickSettlement(pick.getId(), pick.getMarket(), pick.getPick(), result, status,
                outcome.reason(), claim == null ? null : claim.result(), agrees));
        }
        results.saveAllAndFlush(inserts);
        return new MatchSettlement(matchId, match.getStatus(), settled, already, pending, review, out);
    }

    /** Admin: recompute one pick. A different result supersedes the current row (kept for audit). */
    @Transactional
    public PickSettlement recalculate(UUID pickId, RecalculateRequest r, UUID actor) {
        PredictionPick pick = requirePick(pickId);
        Match match = lockMatchOf(pick);
        PredictionOdds o = odds.findById(pick.getOddsId()).orElseThrow();
        Outcome outcome = SettlementEngine.settle(input(pick, o, match));
        Optional<PickResult> current = results.findByPickIdAndCurrentTrue(pickId);
        if (!outcome.settled()) {
            boolean reopened = current.isPresent() && !PENDING.equals(current.get().getResult())
                && !FINAL_STATUSES.contains(match.getStatus());
            if (reopened) {
                // The match is no longer final (e.g. abandoned and replayed): supersede with a PENDING row.
                ObjectNode details = json.valueToTree(outcome.details());
                details.put("previousResult", current.get().getResult());
                replace(current, () -> results.saveAndFlush(newRow(pickId, PENDING, details, "ADMIN_RECALCULATION", actor, r.reason())));
                return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), PENDING, "UNSETTLED", outcome.reason(), null, null);
            }
            return new PickSettlement(pickId, pick.getMarket(), pick.getPick(),
                current.map(PickResult::getResult).orElse(PENDING), PENDING, outcome.reason(), null, null);
        }
        if (current.isPresent() && current.get().getResult().equals(outcome.result())) {
            return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), outcome.result(), "UNCHANGED", null, null, null);
        }
        PickResult created = replace(current, () -> results.saveAndFlush(row(pick, o, outcome, "ADMIN_RECALCULATION", actor, r.reason(), null)));
        return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), created.getResult(),
            current.isPresent() ? "SUPERSEDED" : "SETTLED", null, null, null);
    }

    /** Admin: explicit manual result with a mandatory reason; the engine's view is stored alongside for audit. */
    @Transactional
    public PickSettlement override(UUID pickId, OverrideRequest r, UUID actor) {
        PredictionPick pick = requirePick(pickId);
        Match match = lockMatchOf(pick);
        PredictionOdds o = odds.findById(pick.getOddsId()).orElseThrow();
        Outcome engine = SettlementEngine.settle(input(pick, o, match));
        Optional<PickResult> current = results.findByPickIdAndCurrentTrue(pickId);
        if (current.isPresent() && current.get().getResult().equals(r.result())) {
            return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), r.result(), "UNCHANGED", null, null, null);
        }
        ObjectNode details = json.valueToTree(engine.details());
        details.put("engineResult", engine.result());
        details.put("overriddenTo", r.result());
        PickResult created = replace(current, () -> results.saveAndFlush(newRow(pick.getId(), r.result(), details, "ADMIN_OVERRIDE", actor, r.reason())));
        return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), created.getResult(), "OVERRIDDEN", null, null, null);
    }

    private PickResult replace(Optional<PickResult> current, java.util.function.Supplier<PickResult> create) {
        current.ifPresent(old -> {
            old.setCurrent(false);
            old.setSupersededAt(Instant.now());
            results.saveAndFlush(old); // frees the "one current row per pick" index before the insert
        });
        PickResult created = create.get();
        current.ifPresent(old -> old.setSupersededBy(created.getId()));
        return created;
    }

    /**
     * Settled picks of matches whose result changed after they were settled, where the engine now disagrees with
     * the stored result. Settlement never changes them silently; an admin recalculates or overrides each one.
     */
    @Transactional(readOnly = true)
    public List<ReviewItem> needsReview() {
        // ponytail: newest 500 candidates re-checked in memory; page it if corrections ever reach that volume.
        List<UUID> ids = jdbc.query("""
            SELECT r.id FROM prediction_pick_results r
            JOIN prediction_picks pk ON pk.id = r.pick_id
            JOIN predictions p ON p.id = pk.prediction_id
            WHERE r.is_current AND r.result <> 'PENDING'
              AND EXISTS (SELECT 1 FROM match_result_history h WHERE h.match_id = p.match_id AND h.changed_at > r.settled_at)
            ORDER BY r.settled_at DESC LIMIT 500
            """, Map.of(), (rs, i) -> rs.getObject(1, UUID.class));
        if (ids.isEmpty()) return List.of();
        List<PickResult> candidates = new ArrayList<>(results.findAllById(ids));
        candidates.sort(java.util.Comparator.comparing(PickResult::getSettledAt).reversed());

        Map<UUID, PredictionPick> pickById = byId(picks.findAllById(candidates.stream().map(PickResult::getPickId).toList()), PredictionPick::getId);
        Map<UUID, PredictionOdds> oddsById = byId(odds.findAllById(pickById.values().stream().map(PredictionPick::getOddsId).toList()), PredictionOdds::getId);
        Map<UUID, UUID> matchOfPrediction = predictions.findAllById(pickById.values().stream().map(PredictionPick::getPredictionId).toList())
            .stream().collect(Collectors.toMap(p -> p.getId(), p -> p.getMatchId()));
        Map<UUID, Match> matchById = byId(matches.findAllById(matchOfPrediction.values()), Match::getId);

        List<ReviewItem> out = new ArrayList<>();
        for (PickResult current : candidates) {
            PredictionPick pick = pickById.get(current.getPickId());
            Match m = matchById.get(matchOfPrediction.get(pick.getPredictionId()));
            Outcome now = SettlementEngine.settle(input(pick, oddsById.get(pick.getOddsId()), m));
            if (now.result().equals(current.getResult())) continue;
            out.add(new ReviewItem(pick.getId(), pick.getPredictionId(), m.getId(), m.getHomeTeam(), m.getAwayTeam(), m.getStatus(),
                pick.getMarket(), pick.getPick(), current.getResult(), now.result(), now.reason(), current.getSettledAt()));
        }
        return out;
    }

    private static <T> Map<UUID, T> byId(List<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    /** A new, unsaved result row for a settled outcome. */
    private PickResult row(PredictionPick pick, PredictionOdds o, Outcome outcome, String source, UUID actor,
                           String reason, AiCalculation claim) {
        ObjectNode details = json.valueToTree(outcome.details());
        details.put("oddsId", o.getId().toString());
        details.put("oddsStage", o.getOddsStage());
        if (o.priceOf(pick.getPick()) != null) details.put("price", o.priceOf(pick.getPick()));
        if (claim != null) {
            ObjectNode ai = details.putObject("aiCalculation");
            ai.put("result", claim.result());
            ai.put("explanation", claim.explanation());
            ai.put("agreesWithBackend", claim.result().equals(outcome.result()));
            ai.put("note", "Advisory only; the backend result is authoritative");
        }
        return newRow(pick.getId(), outcome.result(), details, source, actor, reason);
    }

    private static PickResult newRow(UUID pickId, String result, ObjectNode details, String source, UUID actor, String reason) {
        PickResult row = new PickResult();
        row.setPickId(pickId);
        row.setResult(result);
        row.setSettledAt(Instant.now());
        row.setDetails(details);
        row.setSource(source);
        row.setCalculationVersion(SettlementEngine.VERSION);
        row.setReason(reason);
        row.setCreatedBy(actor);
        return row;
    }

    static Input input(PredictionPick pick, PredictionOdds o, Match m) {
        return new Input(pick.getMarket(), pick.getPick(), o.getLine(), o.getSettlementBasis(), m.getStatus(),
            score(m.getFinalHomeScore(), m.getFinalAwayScore()), score(m.getFinalHomeCorners(), m.getFinalAwayCorners()),
            score(o.getHomeScoreAtCapture(), o.getAwayScoreAtCapture()),
            score(o.getHomeCornersAtCapture(), o.getAwayCornersAtCapture()));
    }

    private static Score score(Integer home, Integer away) {
        return home == null || away == null ? null : new Score(home, away);
    }

    private PredictionPick requirePick(UUID id) {
        return picks.findById(id).orElseThrow(() -> ApiException.notFound("PICK_NOT_FOUND", "Pick not found"));
    }

    private Match lockMatchOf(PredictionPick pick) {
        UUID matchId = predictions.findById(pick.getPredictionId()).orElseThrow().getMatchId();
        return matches.lockById(matchId).orElseThrow();
    }
}
