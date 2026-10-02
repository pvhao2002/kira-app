package com.kira.farm.promotion.application;

import com.kira.farm.promotion.domain.Promotion;
import com.kira.farm.shared.domain.Money;
import com.kira.farm.shared.web.ApiException;

import java.time.Instant;

/** Pure promotion rules (no I/O): eligibility of a code for a basket and the discount it gives. */
final class PromotionRules {
    private PromotionRules() {
    }

    /** What a promotion takes off the goods and off the shipping fee, in whole VND. */
    record Discount(long goods, long shipping) {
        long total() {
            return goods + shipping;
        }
    }

    /**
     * Throws a 422 PROMO_* error unless the promotion may be used now, in this branch, for this subtotal, and has
     * uses left globally. The per-user limit needs the database and is checked by the caller.
     */
    static void requireEligible(Promotion p, Instant now, Long branchId, long subtotal) {
        if (!p.isActive()) throw ApiException.unprocessable("PROMO_INACTIVE", "Mã khuyến mãi đang tạm dừng");
        if (now.isBefore(p.getStartsAt()))
            throw ApiException.unprocessable("PROMO_NOT_STARTED", "Mã khuyến mãi chưa đến thời gian áp dụng");
        if (now.isAfter(p.getEndsAt())) throw ApiException.unprocessable("PROMO_EXPIRED", "Mã khuyến mãi đã hết hạn");
        if (!p.isAllBranches() && !p.getBranchIds().contains(branchId))
            throw ApiException.unprocessable("PROMO_BRANCH_NOT_ELIGIBLE", "Mã không áp dụng cho chi nhánh này");
        if (subtotal < p.getMinOrder())
            throw ApiException.unprocessable("PROMO_MIN_ORDER", "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã");
        if (p.getUsageLimit() != null && p.getUsedCount() >= p.getUsageLimit())
            throw ApiException.unprocessable("PROMO_USAGE_LIMIT", "Mã khuyến mãi đã hết lượt sử dụng");
    }

    /** Goods discount is capped at the subtotal; FREE_SHIP discounts the whole (non-negative) shipping fee. */
    static Discount discount(Promotion p, long subtotal, long shippingFee) {
        long goods = 0;
        long shipping = 0;
        switch (p.getType()) {
            case PERCENT -> {
                goods = Money.percentOf(subtotal, p.getValue());
                if (p.getMaxDiscount() != null) goods = Math.min(goods, p.getMaxDiscount());
            }
            case FIXED -> goods = p.getValue();
            case FREE_SHIP -> shipping = Math.max(0, shippingFee);
        }
        return new Discount(Math.min(goods, Math.max(0, subtotal)), shipping);
    }
}
