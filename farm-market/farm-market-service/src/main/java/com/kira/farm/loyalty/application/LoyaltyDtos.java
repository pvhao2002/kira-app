package com.kira.farm.loyalty.application;

import com.kira.farm.loyalty.domain.LoyaltyEntry;
import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.loyalty.domain.Voucher;
import com.kira.farm.loyalty.domain.VoucherStatus;
import com.kira.farm.promotion.domain.PromotionType;

import java.time.Instant;
import java.util.List;

public final class LoyaltyDtos {
    private LoyaltyDtos() {
    }

    public record TierInfo(String code, String label, int minPoints, int discountPercent, boolean freeFastDelivery,
                           List<String> perks) {
        public static TierInfo of(Tier t) {
            return new TierInfo(t.name(), t.label(), t.minPoints(), t.discountPercent(), t.freeFastDelivery(),
                t.perks());
        }
    }

    /**
     * balance counts only unexpired points; yearPoints is what the tier is computed from; expiringSoonPoints
     * expire within 30 days (expiringSoonAt = the earliest of them).
     */
    public record SummaryResponse(long balance, int pointValueVnd, TierInfo tier, TierInfo nextTier,
                                  long pointsToNextTier, long yearPoints, long expiringSoonPoints,
                                  Instant expiringSoonAt) {
    }

    public record HistoryEntry(Long id, int delta, String reason, String refType, String refId, Instant expiresAt,
                               Instant createdAt) {
        public static HistoryEntry of(LoyaltyEntry e) {
            return new HistoryEntry(e.getId(), e.getDelta(), e.getReason(), e.getRefType(), e.getRefId(),
                e.getExpiresAt(), e.getCreatedAt());
        }
    }

    public record RewardResponse(String id, String title, int pointsCost, PromotionType discountType, long value,
                                 long minOrder, int validDays, boolean affordable) {
    }

    public record VoucherResponse(Long id, String code, String title, PromotionType discountType, long value,
                                  long minOrder, int pointsCost, VoucherStatus status, Instant expiresAt,
                                  Instant createdAt) {
        public static VoucherResponse of(Voucher v, Instant now) {
            return new VoucherResponse(v.getId(), v.getCode(), v.getTitle(), v.getDiscountType(), v.getValue(),
                v.getMinOrder(), v.getPointsCost(), v.effectiveStatus(now), v.getExpiresAt(), v.getCreatedAt());
        }
    }
}
