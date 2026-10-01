package com.kira.farm.promotion.application;

import com.kira.farm.promotion.domain.Promotion;
import com.kira.farm.promotion.domain.PromotionType;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class PromotionDtos {
    private PromotionDtos() {
    }

    public record PromotionRequest(
        @NotBlank(message = "Vui lòng nhập mã") @Pattern(regexp = "^[A-Za-z0-9_-]{3,40}$", message = "Mã gồm 3-40 ký tự chữ, số, _ -") String code,
        @NotNull PromotionType type,
        @Min(0) @Max(1_000_000_000L) long value,
        @Min(0) @Max(1_000_000_000L) long minOrder,
        @Min(0) @Max(1_000_000_000L) Long maxDiscount,
        @NotNull Instant startsAt,
        @NotNull Instant endsAt,
        @Min(1) Integer usageLimit,
        @Min(1) Integer perUserLimit,
        Boolean active,
        boolean allBranches,
        @Size(max = 50) Set<Long> branchIds) {
    }

    /** status: RUNNING | UPCOMING | ENDED | DISABLED. */
    public record PromotionResponse(Long id, String code, PromotionType type, long value, long minOrder,
                                    Long maxDiscount, Instant startsAt, Instant endsAt, Integer usageLimit,
                                    Integer perUserLimit, int usedCount, boolean active, boolean allBranches,
                                    List<Long> branchIds, String status) {
        public static PromotionResponse of(Promotion p, Instant now) {
            String status = !p.isActive() ? "DISABLED" : now.isBefore(p.getStartsAt()) ? "UPCOMING"
                : now.isAfter(p.getEndsAt()) ? "ENDED" : "RUNNING";
            return new PromotionResponse(p.getId(), p.getCode(), p.getType(), p.getValue(), p.getMinOrder(),
                p.getMaxDiscount(), p.getStartsAt(), p.getEndsAt(), p.getUsageLimit(), p.getPerUserLimit(),
                p.getUsedCount(), p.isActive(), p.isAllBranches(), p.getBranchIds().stream().sorted().toList(), status);
        }
    }

    public record ValidateRequest(@NotBlank String code, @NotNull Long branchId,
                                  @Min(0) @Max(1_000_000_000L) long subtotal,
                                  @Min(0) @Max(1_000_000_000L) long shippingFee) {
    }

    /**
     * discount reduces the goods subtotal; shippingDiscount reduces the shipping fee (FREE_SHIP).
     * totalDiscount = discount + shippingDiscount is what an order stores in orders.discount.
     */
    public record ValidateResponse(Long promotionId, String code, PromotionType type, long discount,
                                   long shippingDiscount, long totalDiscount) {
    }
}
