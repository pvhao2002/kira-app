package com.kira.farm.order.application;

import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.order.domain.ShippingMethod;
import com.kira.farm.promotion.domain.PromotionType;
import com.kira.farm.shared.domain.Money;
import com.kira.farm.shared.web.ApiException;

/**
 * Immutable money breakdown of a checkout (whole VND). Pure: no I/O, so every rule is unit-testable.
 * <pre>total = subtotal + shippingFee - tierDiscount - discount - pointsDiscount</pre>
 * {@code discount} is the promotion + voucher discount (goods and shipping), already capped so the goods part never
 * exceeds the subtotal left after the tier discount and the shipping part never exceeds the fee.
 */
public record CheckoutPricing(long subtotal, long shippingFee, long tierDiscount, long discount, int pointsUsed,
                              long pointsDiscount, long total) {

    /** What a customer's voucher is worth; null terms mean "no voucher". */
    public record VoucherTerms(PromotionType type, long value) {
    }

    /** Shipping fee for a basket; also the input of promotion evaluation (FREE_SHIP discounts exactly this fee). */
    public static long shippingFee(long subtotal, ShippingMethod method, Tier tier) {
        return method.fee(subtotal, tier.freeFastDelivery());
    }

    /**
     * @param promoGoods    goods discount of the validated promotion code (0 if none)
     * @param promoShipping shipping discount of the validated promotion code (0 if none)
     * @param voucher       the customer's voucher or null
     */
    public static CheckoutPricing price(long subtotal, ShippingMethod method, Tier tier, long promoGoods,
                                        long promoShipping, VoucherTerms voucher) {
        long fee = shippingFee(subtotal, method, tier);
        long tierDiscount = tier.discount(subtotal);
        long voucherGoods = 0;
        long voucherShipping = 0;
        if (voucher != null) {
            switch (voucher.type()) {
                case PERCENT -> voucherGoods = Money.percentOf(subtotal, voucher.value());
                case FIXED -> voucherGoods = voucher.value();
                case FREE_SHIP -> voucherShipping = fee;
            }
        }
        long goodsDiscount = Math.min(subtotal - tierDiscount, promoGoods + voucherGoods);
        long shippingDiscount = Math.min(fee, promoShipping + voucherShipping);
        long discount = goodsDiscount + shippingDiscount;
        long payable = subtotal + fee - tierDiscount - discount;
        return new CheckoutPricing(subtotal, fee, tierDiscount, discount, 0, 0, payable);
    }

    /** Amount due before any loyalty points are spent. */
    public long payable() {
        return total + pointsDiscount;
    }

    /** Spends {@code points} (1 point = {@link LoyaltyService#POINT_VALUE_VND} VND); never more than is payable. */
    public CheckoutPricing withPoints(int points) {
        if (points <= 0) return this;
        long pointsValue = Math.multiplyExact((long) points, (long) LoyaltyService.POINT_VALUE_VND);
        if (pointsValue > payable())
            throw ApiException.unprocessable("POINTS_EXCEED_TOTAL", "Số điểm sử dụng vượt quá giá trị đơn hàng");
        return new CheckoutPricing(subtotal, shippingFee, tierDiscount, discount, points, pointsValue,
            payable() - pointsValue);
    }
}
