package com.kira.farm.order;

import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.order.application.CheckoutPricing;
import com.kira.farm.order.application.CheckoutPricing.VoucherTerms;
import com.kira.farm.order.domain.ShippingMethod;
import com.kira.farm.promotion.domain.PromotionType;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CheckoutPricingTest {
    @Test
    void plainBasketPaysSubtotalPlusShipping() {
        var p = CheckoutPricing.price(150_000, ShippingMethod.STANDARD, Tier.DONG, 0, 0, null);
        assertEquals(25_000, p.shippingFee());
        assertEquals(175_000, p.total());
        assertEquals(175_000, p.payable());
        assertEquals(0, p.discount() + p.tierDiscount() + p.pointsDiscount());
    }

    @Test
    void tierDiscountAndFreeShippingThreshold() {
        var vang = CheckoutPricing.price(300_000, ShippingMethod.STANDARD, Tier.VANG, 0, 0, null);
        assertEquals(0, vang.shippingFee());
        assertEquals(9_000, vang.tierDiscount());           // 3% of 300.000
        assertEquals(291_000, vang.total());
        var kc = CheckoutPricing.price(100_000, ShippingMethod.FAST, Tier.KIM_CUONG, 0, 0, null);
        assertEquals(0, kc.shippingFee());                  // diamond: free 2-hour delivery
        assertEquals(8_000, kc.tierDiscount());
        assertEquals(92_000, kc.total());
    }

    @Test
    void promoAndVoucherStackButNeverExceedGoodsOrFee() {
        // promo 30k goods + FIXED voucher 50k on 60k goods, tier VANG (1.8k): goods discount is capped at 58.2k
        var p = CheckoutPricing.price(60_000, ShippingMethod.STANDARD, Tier.VANG, 30_000, 0,
            new VoucherTerms(PromotionType.FIXED, 50_000));
        assertEquals(1_800, p.tierDiscount());
        assertEquals(58_200, p.discount());
        assertEquals(60_000 + 25_000 - 1_800 - 58_200, p.total());
        // shipping discounts (promo FREE_SHIP + voucher FREE_SHIP) are capped at the fee, not doubled
        var q = CheckoutPricing.price(60_000, ShippingMethod.STANDARD, Tier.DONG, 0, 25_000,
            new VoucherTerms(PromotionType.FREE_SHIP, 0));
        assertEquals(25_000, q.discount());
        assertEquals(60_000, q.total());
    }

    @Test
    void percentVoucherRoundsHalfUp() {
        var p = CheckoutPricing.price(10_050, ShippingMethod.PICKUP, Tier.DONG, 0, 0,
            new VoucherTerms(PromotionType.PERCENT, 5));    // 502.5 -> 503
        assertEquals(503, p.discount());
        assertEquals(10_050 - 503, p.total());
    }

    @Test
    void pointsAreWorth100DongAndCannotExceedWhatIsPayable() {
        var base = CheckoutPricing.price(100_000, ShippingMethod.PICKUP, Tier.DONG, 0, 0, null);
        var spent = base.withPoints(250);
        assertEquals(25_000, spent.pointsDiscount());
        assertEquals(250, spent.pointsUsed());
        assertEquals(75_000, spent.total());
        assertEquals(100_000, spent.payable());              // payable ignores points
        assertSame(base, base.withPoints(0));
        var all = base.withPoints(1_000);                    // exactly the payable amount
        assertEquals(0, all.total());
        var e = assertThrows(ApiException.class, () -> base.withPoints(1_001));
        assertEquals("POINTS_EXCEED_TOTAL", e.getCode());
    }
}
