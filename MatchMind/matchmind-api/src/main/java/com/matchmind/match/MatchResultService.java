package com.matchmind.match;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.external.ExternalDtos.ResultRequest;
import com.matchmind.settlement.SettlementService;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.shared.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Applies match results. Providers report them through POST /api/v1/external/matches/results (only the provider that
 * owns the match); admins enter or correct them through POST /api/v1/matches/{id}/result. Every change is written to
 * match_result_history; identical re-sends are no-ops; out-of-order (older) provider results are rejected. A FINISHED
 * or CANCELLED result immediately settles the still-pending picks of the match.
 * <p>
 * A trusted source (an admin, or a per-provider key with the RESULTS scope, which the results endpoint requires) shares
 * the result with every other member of the match's fixture in the same transaction, one history row each (owner
 * decision 3 phase 2). The legacy shared key is not trusted: its result reaches only same-provider siblings (decision
 * 4), and other providers' members keep their own result. A member whose own provider result is newer keeps it too;
 * the fixture then shows {@code resultMismatch}.
 */
@Service
@RequiredArgsConstructor
public class MatchResultService {
    /** How far a reported time may run ahead of the server clock. */
    static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);
    private final MatchRepository matches;
    private final MatchResultHistoryRepository history;
    private final SettlementService settlement;
    private final ObjectMapper json;

    /** {@code propagatedTo}: the other fixture members whose result changed with this one. */
    public record ResultResponse(UUID matchId, String status, boolean changed, MatchSettlement settlement,
                                 List<UUID> propagatedTo) {
    }

    /** An admin result. It is applied as of now, so it also replaces a provider result with a later resultAt. */
    public record AdminResultRequest(@NotBlank @Pattern(regexp = "SCHEDULED|LIVE|FINISHED|CANCELLED|POSTPONED") String status,
                                     @Valid Pair finalScore,
                                     @Valid Pair finalCorners,
                                     @Valid Pair halfTimeScore,
                                     @Valid Pair halfTimeCorners,
                                     @Size(max = 2000) String reason) {
    }

    /** {@code trusted}: a per-provider key with RESULTS; false for the legacy shared key (same-provider siblings only). */
    @Transactional
    public ResultResponse apply(UUID providerId, ResultRequest r, String requestId, boolean trusted) {
        validate(r);
        // A trusted results key (the Google Sheet SETTLE tab) may name any provider's match by its MatchMind id.
        boolean anyProvider = trusted && r.matchId() != null && r.externalMatchId() == null && r.predictionId() == null
            && matches.existsById(r.matchId());
        UUID id = anyProvider ? r.matchId() : matchIdOf(providerId, r.externalMatchId(), r.matchId(), r.predictionId());
        List<Match> members = lockFixture(id);
        Match m = matches.lockById(id).orElseThrow();
        Instant now = Instant.now();
        if ("FINISHED".equals(r.status()) && m.getStartTime().isAfter(now)) {
            throw ApiException.conflict("MATCH_NOT_STARTED",
                "The match starts at " + m.getStartTime() + ", so it cannot be FINISHED yet");
        }
        ObjectNode audit = json.createObjectNode();
        if (requestId != null) audit.put("requestId", requestId);
        return share(record(m, r, "PROVIDER", null, audit, "AUTO", now), m, members, r.resultAt(), "PROVIDER", null, audit,
            "AUTO", now, trusted ? null : m.getProviderId());
    }

    /** Admin entry or correction: never STALE_RESULT, history source ADMIN with the admin's id and username. */
    @Transactional
    public ResultResponse applyByAdmin(UUID matchId, AdminResultRequest a, UUID adminId, String adminUsername) {
        Instant now = Instant.now();
        ResultRequest r = new ResultRequest(null, matchId, null, a.status(), a.finalScore(), a.finalCorners(),
            a.halfTimeScore(), a.halfTimeCorners(), now);
        validate(r);
        List<Match> members = lockFixture(matchId);
        Match m = matches.lockById(matchId).orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "Match not found"));
        ObjectNode audit = json.createObjectNode();
        audit.put("changedBy", adminUsername);
        if (a.reason() != null && !a.reason().isBlank()) audit.put("reason", a.reason().trim());
        return share(record(m, r, "ADMIN", adminId, audit, "ADMIN_SETTLEMENT", now), m, members, now, "ADMIN", adminId, audit,
            "ADMIN_SETTLEMENT", now, null);
    }

    /**
     * The match named by exactly one of the three ids, owned by the provider. Agents whose match id was generated by
     * the server ({@code auto-...}) only know the matchId and predictionId of the prediction response.
     */
    public UUID matchIdOf(UUID providerId, String externalMatchId, UUID matchId, UUID predictionId) {
        long given = Stream.of(externalMatchId, matchId, predictionId).filter(Objects::nonNull).count();
        if (given != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Name the match with exactly one id",
                Map.of(given == 0 ? "externalMatchId" : "matchId", "send exactly one of externalMatchId, matchId or predictionId"));
        }
        Optional<UUID> id = externalMatchId != null ? matches.findIdByProviderAndExternalId(providerId, externalMatchId)
            : matchId != null ? matches.findIdByProviderAndId(providerId, matchId)
            : matches.findIdByProviderAndPrediction(providerId, predictionId);
        return id.orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND",
            "No match with this id exists for your provider; send a prediction for it first"));
    }

    private ResultResponse record(Match m, ResultRequest r, String source, UUID actor, ObjectNode audit,
                                  String settlementSource, Instant now) {
        Map<String, Object> before = m.resultSnapshot();
        Match next = merged(m, r);
        Map<String, Object> after = next.resultSnapshot();

        boolean changed = !Objects.equals(before, after);
        // A stored time beyond the allowed skew was accepted before that rule existed: it must not block real results.
        Instant stored = m.getResultUpdatedAt();
        boolean trusted = stored != null && !stored.isAfter(now.plus(MAX_CLOCK_SKEW));
        if (changed && "PROVIDER".equals(source) && trusted && r.resultAt().isBefore(stored)) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_RESULT",
                "A newer result (" + stored + ") is already stored for this match");
        }
        if (changed) write(m, next, r.resultAt(), source, actor, audit);
        MatchSettlement s = FINAL.contains(m.getStatus())
            ? settlement.settleMatch(m.getId(), settlementSource, actor, null) : null;
        return new ResultResponse(m.getId(), m.getStatus(), changed, s, List.of());
    }

    private static final List<String> FINAL = List.of("FINISHED", "CANCELLED");

    /**
     * Every fixture member, locked in id order like {@code FixtureService.merge}. A lock statement that waited on a
     * concurrent merge read the origin's fixture on its old snapshot and misses rows moved in, so it repeats until the
     * locked set is stable: that last run waited on nothing, so it saw every committed move. A merge touching this
     * fixture must lock the members held here, so none can commit afterwards.
     */
    private List<Match> lockFixture(UUID id) {
        List<Match> members = matches.lockFixtureMembers(id);
        while (true) {
            List<Match> again = matches.lockFixtureMembers(id);
            if (again.stream().map(Match::getId).toList().equals(members.stream().map(Match::getId).toList())) return again;
            members = again;
        }
    }

    /**
     * Copies the origin's result to every other fixture member that differs, with a history row and settlement each.
     * Skipped: a member whose provider result is newer (provider source only; an admin result always wins) and, for
     * FINISHED, a member whose kick-off is still ahead. {@code onlyProvider} (null = every provider) limits the copy to
     * that provider's members.
     */
    private ResultResponse share(ResultResponse res, Match origin, List<Match> members, Instant resultAt, String source,
                                 UUID actor, ObjectNode audit, String settlementSource, Instant now, UUID onlyProvider) {
        List<UUID> updated = new ArrayList<>();
        for (Match x : members) {
            if (x.getId().equals(origin.getId()) || Objects.equals(x.resultSnapshot(), origin.resultSnapshot())) continue;
            if (onlyProvider != null && !onlyProvider.equals(x.getProviderId())) continue;
            Instant stored = x.getResultUpdatedAt();
            boolean newer = stored != null && !stored.isAfter(now.plus(MAX_CLOCK_SKEW)) && resultAt.isBefore(stored);
            boolean notStarted = "FINISHED".equals(origin.getStatus()) && x.getStartTime().isAfter(now);
            if ("PROVIDER".equals(source) && (newer || notStarted)) continue;
            ObjectNode a = audit.deepCopy();
            a.put("propagatedFrom", origin.getId().toString());
            write(x, origin, resultAt, source, actor, a);
            if (FINAL.contains(x.getStatus())) settlement.settleMatch(x.getId(), settlementSource, actor, null);
            updated.add(x.getId());
        }
        return new ResultResponse(res.matchId(), res.status(), res.changed(), res.settlement(), List.copyOf(updated));
    }

    /** Stores {@code next}'s result on {@code m} with one match_result_history row. */
    private void write(Match m, Match next, Instant resultAt, String source, UUID actor, ObjectNode audit) {
        MatchResultHistory h = new MatchResultHistory();
        h.setMatchId(m.getId());
        h.setPreviousResult(json.valueToTree(m.resultSnapshot()));
        ObjectNode newResult = json.valueToTree(next.resultSnapshot());
        newResult.put("resultAt", resultAt.toString());
        newResult.setAll(audit);
        h.setNewResult(newResult);
        h.setChangeSource(source);
        h.setChangedBy(actor);
        history.save(h);

        m.setStatus(next.getStatus());
        m.setFinalHomeScore(next.getFinalHomeScore());
        m.setFinalAwayScore(next.getFinalAwayScore());
        m.setFinalHomeCorners(next.getFinalHomeCorners());
        m.setFinalAwayCorners(next.getFinalAwayCorners());
        m.setHtHomeScore(next.getHtHomeScore());
        m.setHtAwayScore(next.getHtAwayScore());
        m.setHtHomeCorners(next.getHtHomeCorners());
        m.setHtAwayCorners(next.getHtAwayCorners());
        m.setResultUpdatedAt(resultAt);
        matches.saveAndFlush(m);
    }

    /**
     * The stored result with the request applied. Optional details the request leaves out (final corners, half-time
     * data) keep their stored value while the match stays FINISHED (or LIVE for half-time data), so a follow-up that
     * only adds half-time data does not erase the corners. Fields that cannot exist for the new status are cleared.
     */
    static Match merged(Match stored, ResultRequest r) {
        Match next = new Match();
        next.setStatus(r.status());
        boolean finished = "FINISHED".equals(r.status());
        boolean halfTimeAllowed = finished || "LIVE".equals(r.status());
        Pair.apply(r.finalScore(), next::setFinalHomeScore, next::setFinalAwayScore);
        if (finished) {
            Pair.apply(or(r.finalCorners(), pair(stored.getFinalHomeCorners(), stored.getFinalAwayCorners())),
                next::setFinalHomeCorners, next::setFinalAwayCorners);
        }
        if (halfTimeAllowed) {
            Pair.apply(or(r.halfTimeScore(), pair(stored.getHtHomeScore(), stored.getHtAwayScore())), next::setHtHomeScore, next::setHtAwayScore);
            Pair.apply(or(r.halfTimeCorners(), pair(stored.getHtHomeCorners(), stored.getHtAwayCorners())),
                next::setHtHomeCorners, next::setHtAwayCorners);
        }
        Map<String, String> errors = new LinkedHashMap<>();
        if (exceeds(next.getHtHomeScore(), next.getHtAwayScore(), next.getFinalHomeScore(), next.getFinalAwayScore())) {
            errors.put("halfTimeScore", "the half-time score (sent or stored) cannot exceed the final score");
        }
        if (exceeds(next.getHtHomeCorners(), next.getHtAwayCorners(), next.getFinalHomeCorners(), next.getFinalAwayCorners())) {
            errors.put("halfTimeCorners", "the half-time corners (sent or stored) cannot exceed the final corners");
        }
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Result payload is invalid", errors);
        return next;
    }

    private static boolean exceeds(Integer htHome, Integer htAway, Integer ftHome, Integer ftAway) {
        return htHome != null && ftHome != null && (htHome > ftHome || htAway > ftAway);
    }

    private static Pair or(Pair sent, Pair stored) {
        return sent != null ? sent : stored;
    }

    private static Pair pair(Integer home, Integer away) {
        return home == null || away == null ? null : new Pair(home, away);
    }

    static void validate(ResultRequest r) {
        Map<String, String> errors = new LinkedHashMap<>();
        boolean finished = "FINISHED".equals(r.status());
        if (finished && r.finalScore() == null) errors.put("finalScore", "required when status is FINISHED");
        if (!finished && r.finalScore() != null) errors.put("finalScore", "only allowed when status is FINISHED");
        if (!finished && r.finalCorners() != null) errors.put("finalCorners", "only allowed when status is FINISHED");
        if (r.halfTimeScore() != null && r.finalScore() != null
            && (r.halfTimeScore().home() > r.finalScore().home() || r.halfTimeScore().away() > r.finalScore().away())) {
            errors.put("halfTimeScore", "cannot exceed the final score");
        }
        if (r.halfTimeCorners() != null && r.finalCorners() != null
            && (r.halfTimeCorners().home() > r.finalCorners().home() || r.halfTimeCorners().away() > r.finalCorners().away())) {
            errors.put("halfTimeCorners", "cannot exceed the final corners");
        }
        if (List.of("SCHEDULED", "CANCELLED", "POSTPONED").contains(r.status())
            && (r.halfTimeScore() != null || r.halfTimeCorners() != null)) {
            errors.put("status", "half-time data is not allowed for status " + r.status());
        }
        Instant now = Instant.now();
        if (r.resultAt() != null && r.resultAt().isAfter(now.plus(MAX_CLOCK_SKEW))) {
            errors.put("resultAt", "must not be more than 5 minutes in the future (server time " + now + ")");
        }
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Result payload is invalid", errors);
    }
}
