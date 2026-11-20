package com.matchmind.match;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalDtos.Pair;
import com.matchmind.external.ExternalDtos.ResultRequest;
import com.matchmind.settlement.SettlementService;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.shared.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * POST /api/v1/external/matches/results. Only the provider that owns the match may report its result. Every change
 * is written to match_result_history; identical re-sends are no-ops; out-of-order (older) results are rejected.
 * A FINISHED or CANCELLED result immediately settles the still-pending picks of the match.
 */
@Service
@RequiredArgsConstructor
public class MatchResultService {
    private final MatchRepository matches;
    private final MatchResultHistoryRepository history;
    private final SettlementService settlement;
    private final ObjectMapper json;

    public record ResultResponse(UUID matchId, String status, boolean changed, MatchSettlement settlement) {
    }

    @Transactional
    public ResultResponse apply(UUID providerId, ResultRequest r, String requestId) {
        validate(r);
        Match m = matches.lockByProviderAndExternalId(providerId, r.externalMatchId())
            .orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND",
                "No match with this externalMatchId exists for your provider; send a prediction for it first"));

        Map<String, Object> before = m.resultSnapshot();
        Match next = merged(m, r);
        Map<String, Object> after = next.resultSnapshot();

        boolean changed = !Objects.equals(before, after);
        if (changed && m.getResultUpdatedAt() != null && r.resultAt().isBefore(m.getResultUpdatedAt())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_RESULT",
                "A newer result (" + m.getResultUpdatedAt() + ") is already stored for this match");
        }
        if (changed) {
            MatchResultHistory h = new MatchResultHistory();
            h.setMatchId(m.getId());
            h.setPreviousResult(json.valueToTree(before));
            ObjectNode newResult = json.valueToTree(after);
            newResult.put("resultAt", r.resultAt().toString());
            if (requestId != null) newResult.put("requestId", requestId);
            h.setNewResult(newResult);
            h.setChangeSource("PROVIDER");
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
            m.setResultUpdatedAt(r.resultAt());
            matches.saveAndFlush(m);
        }
        MatchSettlement s = List.of("FINISHED", "CANCELLED").contains(m.getStatus())
            ? settlement.settleMatch(m.getId(), "AUTO", null, null) : null;
        return new ResultResponse(m.getId(), m.getStatus(), changed, s);
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
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Result payload is invalid", errors);
    }
}
