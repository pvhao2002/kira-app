package com.matchmind.settlement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalDtos.AiCalculation;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.match.Match;
import com.matchmind.provider.Provider;
import com.matchmind.provider.ProviderRepository;
import com.matchmind.match.MatchRepository;
import com.matchmind.prediction.PredictionOdds;
import com.matchmind.prediction.PredictionOddsRepository;
import com.matchmind.prediction.Prediction;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
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
    private final ProviderRepository providers;
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

    /**
     * Admin: recompute one pick. The new row supersedes the current one (kept for audit) even when the result is
     * the same, so the reason and the acting admin are always recorded; the status says whether it changed. The
     * response's {@code reason} is the admin's reason when a row was written, otherwise why the pick stays pending.
     */
    @Transactional
    public PickSettlement recalculate(UUID pickId, RecalculateRequest r, UUID actor, String username) {
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
                details.put("actedBy", username);
                replace(current, () -> results.saveAndFlush(newRow(pickId, PENDING, details, "ADMIN_RECALCULATION", actor, r.reason())));
                return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), PENDING, "UNSETTLED", r.reason(), null, null);
            }
            return new PickSettlement(pickId, pick.getMarket(), pick.getPick(),
                current.map(PickResult::getResult).orElse(PENDING), PENDING, outcome.reason(), null, null);
        }
        boolean unchanged = current.isPresent() && current.get().getResult().equals(outcome.result());
        PickResult row = row(pick, o, outcome, "ADMIN_RECALCULATION", actor, r.reason(), null);
        ((ObjectNode) row.getDetails()).put("actedBy", username);
        replace(current, () -> results.saveAndFlush(row));
        return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), outcome.result(),
            unchanged ? "UNCHANGED" : current.isPresent() ? "SUPERSEDED" : "SETTLED", r.reason(), null, null);
    }

    /**
     * Admin: explicit manual result with a mandatory reason; the engine's view is stored alongside for audit. Only
     * for a match with a final result: an override before that would count in win rates for a match not yet played.
     */
    @Transactional
    public PickSettlement override(UUID pickId, OverrideRequest r, UUID actor, String username) {
        PredictionPick pick = requirePick(pickId);
        Match match = lockMatchOf(pick);
        if (!FINAL_STATUSES.contains(match.getStatus())) {
            throw ApiException.conflict("MATCH_NOT_FINAL",
                "The match is " + match.getStatus() + ". Enter its final result first; overrides need a FINISHED or CANCELLED match");
        }
        PredictionOdds o = odds.findById(pick.getOddsId()).orElseThrow();
        Outcome engine = SettlementEngine.settle(input(pick, o, match));
        Optional<PickResult> current = results.findByPickIdAndCurrentTrue(pickId);
        if (current.isPresent() && current.get().getResult().equals(r.result())) {
            // Idempotent (e.g. a double-click): nothing is written, so the reason of the stored row is returned.
            return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), r.result(), "UNCHANGED",
                current.get().getReason(), null, null);
        }
        ObjectNode details = json.valueToTree(engine.details());
        details.put("engineResult", engine.result());
        details.put("overriddenTo", r.result());
        details.put("actedBy", username);
        PickResult created = replace(current, () -> results.saveAndFlush(newRow(pick.getId(), r.result(), details, "ADMIN_OVERRIDE", actor, r.reason())));
        return new PickSettlement(pickId, pick.getMarket(), pick.getPick(), created.getResult(), "OVERRIDDEN", r.reason(), null, null);
    }

    /** Admin: recalculates every pick of the match that {@link #needsReview} lists, with one shared reason. */
    @Transactional
    public List<PickSettlement> recalculateMatch(UUID matchId, RecalculateRequest r, UUID actor, String username) {
        matches.lockById(matchId).orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "Match not found"));
        return needsReview(matchId, null).stream().map(item -> recalculate(item.pickId(), r, actor, username)).toList();
    }

    /** Everything the settlement prompt needs about one match, with the pick ids to send back. */
    /** {@code provider}: the provider code, which the settle call sends as X-Provider. */
    public record PromptInput(UUID matchId, String externalMatchId, String provider, String league, String homeTeam, String awayTeam,
                              Instant startTime, String status, Pair finalScore, Pair finalCorners, Pair halfTimeScore,
                              List<PromptInputPick> picks) {
    }

    public record PromptInputPick(UUID pickId, UUID predictionId, String market, String pick, BigDecimal line,
                                  String lineDisplay, String oddsStage, String settlementBasis, BigDecimal price,
                                  Pair scoreAtCapture, Pair cornersAtCapture, String currentResult) {
    }

    /** A match that still waits for its result: what the Google Sheet SETTLE tab lists for an agent to fill in. */
    public record UnsettledMatch(UUID matchId, String provider, String league, String homeTeam, String awayTeam,
                                 Instant startTime, String status, int pendingPicks) {
    }

    /**
     * Matches of every provider with at least one pending pick whose kick-off was over 2 hours ago (so the game is
     * normally over), oldest first. Cancelled and archived matches are left out.
     */
    @Transactional(readOnly = true)
    public List<UnsettledMatch> unsettledMatches() {
        // ponytail: fixed cap of 500 rows; page it if the backlog ever grows past that.
        return jdbc.query("""
            SELECT m.id, p.code, m.league, m.home_team, m.away_team, m.start_time, m.status, count(*) AS pending
            FROM matches m
            JOIN providers p ON p.id = m.provider_id
            JOIN predictions pr ON pr.match_id = m.id
            JOIN prediction_picks k ON k.prediction_id = pr.id
            LEFT JOIN prediction_pick_results r ON r.pick_id = k.id AND r.is_current
            WHERE m.archived_at IS NULL AND p.archived_at IS NULL AND m.status <> 'CANCELLED'
              AND m.start_time < now() - interval '2 hours'
              AND (r.id IS NULL OR r.result = 'PENDING')
            GROUP BY m.id, p.code
            ORDER BY m.start_time, m.id
            LIMIT 500""", Map.of(), (rs, i) -> new UnsettledMatch(rs.getObject("id", UUID.class), rs.getString("code"),
            rs.getString("league"), rs.getString("home_team"), rs.getString("away_team"),
            rs.getTimestamp("start_time").toInstant(), rs.getString("status"), rs.getInt("pending")));
    }

    @Transactional(readOnly = true)
    public PromptInput promptInput(UUID matchId) {
        Match m = matches.findById(matchId).orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "Match not found"));
        List<PredictionPick> matchPicks = picks.findByMatchId(matchId);
        Map<UUID, PredictionOdds> oddsById = byId(odds.findAllById(matchPicks.stream().map(PredictionPick::getOddsId).toList()), PredictionOdds::getId);
        Map<UUID, String> resultByPick = results.findByPickIdInAndCurrentTrue(matchPicks.stream().map(PredictionPick::getId).toList())
            .stream().collect(Collectors.toMap(PickResult::getPickId, PickResult::getResult));
        List<PromptInputPick> out = matchPicks.stream().map(pk -> {
            PredictionOdds o = oddsById.get(pk.getOddsId());
            return new PromptInputPick(pk.getId(), pk.getPredictionId(), pk.getMarket(), pk.getPick(), o.getLine(),
                o.getLineDisplay(), o.getOddsStage(), o.getSettlementBasis(), o.priceOf(pk.getPick()),
                pair(o.getHomeScoreAtCapture(), o.getAwayScoreAtCapture()), pair(o.getHomeCornersAtCapture(), o.getAwayCornersAtCapture()),
                resultByPick.getOrDefault(pk.getId(), PENDING));
        }).toList();
        String provider = providers.findById(m.getProviderId()).map(Provider::getCode).orElse(null);
        return new PromptInput(m.getId(), m.getExternalMatchId(), provider, m.getLeague(), m.getHomeTeam(), m.getAwayTeam(), m.getStartTime(),
            m.getStatus(), pair(m.getFinalHomeScore(), m.getFinalAwayScore()), pair(m.getFinalHomeCorners(), m.getFinalAwayCorners()),
            pair(m.getHtHomeScore(), m.getHtAwayScore()), out);
    }

    private static Pair pair(Integer home, Integer away) {
        return home == null || away == null ? null : new Pair(home, away);
    }

    private PickResult replace(Optional<PickResult> current, Supplier<PickResult> create) {
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
    public List<ReviewItem> needsReview(UUID matchId, UUID predictionId) {
        Map<String, Object> params = new HashMap<>();
        StringBuilder filter = new StringBuilder();
        if (matchId != null) {
            filter.append(" AND p.match_id = :matchId");
            params.put("matchId", matchId);
        }
        if (predictionId != null) {
            filter.append(" AND p.id = :predictionId");
            params.put("predictionId", predictionId);
        }
        // ponytail: newest 500 candidates re-checked in memory; page it if corrections ever reach that volume.
        List<UUID> ids = jdbc.query("""
            SELECT r.id FROM prediction_pick_results r
            JOIN prediction_picks pk ON pk.id = r.pick_id
            JOIN predictions p ON p.id = pk.prediction_id
            WHERE r.is_current AND r.result <> 'PENDING'
              AND EXISTS (SELECT 1 FROM match_result_history h WHERE h.match_id = p.match_id AND h.changed_at > r.settled_at)%s
            ORDER BY r.settled_at DESC LIMIT 500
            """.formatted(filter), params, (rs, i) -> rs.getObject(1, UUID.class));
        if (ids.isEmpty()) return List.of();
        List<PickResult> candidates = results.findAllById(ids).stream()
            .sorted(Comparator.comparing(PickResult::getSettledAt).reversed()).toList();

        Map<UUID, PredictionPick> pickById = byId(picks.findAllById(candidates.stream().map(PickResult::getPickId).toList()), PredictionPick::getId);
        Map<UUID, PredictionOdds> oddsById = byId(odds.findAllById(pickById.values().stream().map(PredictionPick::getOddsId).toList()), PredictionOdds::getId);
        Map<UUID, UUID> matchOfPrediction = predictions.findAllById(pickById.values().stream().map(PredictionPick::getPredictionId).toList())
            .stream().collect(Collectors.toMap(Prediction::getId, Prediction::getMatchId));
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
