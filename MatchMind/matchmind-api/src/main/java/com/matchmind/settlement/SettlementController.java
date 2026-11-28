package com.matchmind.settlement;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.settlement.SettlementService.OverrideRequest;
import com.matchmind.settlement.SettlementService.PickSettlement;
import com.matchmind.settlement.SettlementService.PromptInput;
import com.matchmind.settlement.SettlementService.RecalculateRequest;
import com.matchmind.settlement.SettlementService.ReviewItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Internal settlement workflow: POST under /api/v1 requires ADMIN in SecurityConfig; GETs are readable by viewers. */
@RestController
@RequestMapping("/api/v1/settlements")
@RequiredArgsConstructor
@Tag(name = "Settlement (admin)")
public class SettlementController {
    private final SettlementService service;

    @GetMapping("/needs-review")
    @Operation(summary = "Settled picks whose match result changed afterwards and would now settle differently; "
        + "optionally only those of one match or one prediction")
    public List<ReviewItem> needsReview(@RequestParam(required = false) UUID matchId,
                                        @RequestParam(required = false) UUID predictionId) {
        return service.needsReview(matchId, predictionId);
    }

    @PostMapping("/matches/{matchId}")
    @Operation(summary = "Settle all pending picks of a match")
    public MatchSettlement settleMatch(@PathVariable UUID matchId, @AuthenticationPrincipal UserPrincipal me) {
        return service.settleMatch(matchId, "ADMIN_SETTLEMENT", me.id(), null);
    }

    @PostMapping("/matches/{matchId}/recalculate")
    @Operation(summary = "Recalculate every pick of the match that needs review, with one reason (audited)")
    public List<PickSettlement> recalculateMatch(@PathVariable UUID matchId, @Valid @RequestBody RecalculateRequest r,
                                                 @AuthenticationPrincipal UserPrincipal me) {
        return service.recalculateMatch(matchId, r, me.id(), me.username());
    }

    @GetMapping("/matches/{matchId}/prompt-input")
    @Operation(summary = "The match result and its picks with ids: the input of the settlement prompt")
    public PromptInput promptInput(@PathVariable UUID matchId) {
        return service.promptInput(matchId);
    }

    @PostMapping("/picks/{pickId}/recalculate")
    @Operation(summary = "Recompute one pick; always writes a new audited row, status says whether the result changed")
    public PickSettlement recalculate(@PathVariable UUID pickId, @Valid @RequestBody RecalculateRequest r,
                                      @AuthenticationPrincipal UserPrincipal me) {
        return service.recalculate(pickId, r, me.id(), me.username());
    }

    @PostMapping("/picks/{pickId}/override")
    @Operation(summary = "Manually set a result with a mandatory reason (audited); the match must be FINISHED, CANCELLED or POSTPONED")
    public PickSettlement override(@PathVariable UUID pickId, @Valid @RequestBody OverrideRequest r,
                                   @AuthenticationPrincipal UserPrincipal me) {
        return service.override(pickId, r, me.id(), me.username());
    }
}
