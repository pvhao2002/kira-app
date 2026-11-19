package com.matchmind.settlement;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.settlement.SettlementService.OverrideRequest;
import com.matchmind.settlement.SettlementService.PickSettlement;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Internal settlement workflow: POST under /api/v1 requires ADMIN in SecurityConfig; the review list is readable by viewers. */
@RestController
@RequestMapping("/api/v1/settlements")
@RequiredArgsConstructor
@Tag(name = "Settlement (admin)")
public class SettlementController {
    private final SettlementService service;

    @GetMapping("/needs-review")
    @Operation(summary = "Settled picks whose match result changed afterwards and would now settle differently")
    public List<ReviewItem> needsReview() {
        return service.needsReview();
    }

    @PostMapping("/matches/{matchId}")
    @Operation(summary = "Settle all pending picks of a match")
    public MatchSettlement settleMatch(@PathVariable UUID matchId, @AuthenticationPrincipal UserPrincipal me) {
        return service.settleMatch(matchId, "ADMIN_SETTLEMENT", me.id(), null);
    }

    @PostMapping("/picks/{pickId}/recalculate")
    @Operation(summary = "Recompute one pick; a different result supersedes the current one (audited)")
    public PickSettlement recalculate(@PathVariable UUID pickId, @Valid @RequestBody RecalculateRequest r,
                                      @AuthenticationPrincipal UserPrincipal me) {
        return service.recalculate(pickId, r, me.id());
    }

    @PostMapping("/picks/{pickId}/override")
    @Operation(summary = "Manually set a result with a mandatory reason (audited)")
    public PickSettlement override(@PathVariable UUID pickId, @Valid @RequestBody OverrideRequest r,
                                   @AuthenticationPrincipal UserPrincipal me) {
        return service.override(pickId, r, me.id());
    }
}
