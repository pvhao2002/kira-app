package com.kira.farm.loyalty.web;

import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.IdempotencyKey;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.farm.loyalty.application.LoyaltyDtos.*;

@Tag(name = "Loyalty")
@RestController
@RequestMapping("/api/v1/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {
    private final LoyaltyService service;

    @GetMapping("/summary")
    public SummaryResponse summary() {
        return service.summary();
    }

    /** type: all | earn | spend. */
    @GetMapping("/history")
    public PageResponse<HistoryEntry> history(@RequestParam(defaultValue = "all") String type,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return service.history(type, page, size);
    }

    @GetMapping("/rewards")
    public List<RewardResponse> rewards() {
        return service.rewards();
    }

    @Operation(summary = "Redeem points for a voucher; idempotent per Idempotency-Key")
    @PostMapping("/rewards/{id}/redeem")
    public VoucherResponse redeem(@PathVariable String id,
                                  @RequestHeader(value = IdempotencyKey.HEADER, required = false) String idempotencyKey) {
        return service.redeem(id, idempotencyKey);
    }

    @GetMapping("/vouchers")
    public List<VoucherResponse> vouchers() {
        return service.vouchers();
    }
}
