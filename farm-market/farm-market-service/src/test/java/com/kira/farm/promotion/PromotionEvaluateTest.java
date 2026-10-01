package com.kira.farm.promotion;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.promotion.application.PromotionDtos.ValidateResponse;
import com.kira.farm.promotion.application.PromotionService;
import com.kira.farm.promotion.domain.Promotion;
import com.kira.farm.promotion.domain.PromotionType;
import com.kira.farm.promotion.infrastructure.PromotionRepository;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PromotionEvaluateTest {
    PromotionRepository repo = mock(PromotionRepository.class);
    PromotionService svc = new PromotionService(repo, mock(BranchRepository.class), mock(BranchAccess.class));

    Promotion promo(PromotionType type, long value) {
        Promotion p = new Promotion();
        p.setId(7L);
        p.setCode("SALE");
        p.setType(type);
        p.setValue(value);
        p.setStartsAt(Instant.now().minus(1, ChronoUnit.DAYS));
        p.setEndsAt(Instant.now().plus(1, ChronoUnit.DAYS));
        when(repo.findByCode("SALE")).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void percentRoundsHalfUpAndHonoursCap() {
        Promotion p = promo(PromotionType.PERCENT, 15);
        assertEquals(50_000, svc.evaluate("sale", 1L, 1L, 333_335, 25_000).discount()); // 50000.25 -> 50000
        assertEquals(2, svc.evaluate("sale", 1L, 1L, 10, 0).discount());                // 1.5 -> 2
        p.setMaxDiscount(30_000L);
        assertEquals(30_000, svc.evaluate("sale", 1L, 1L, 333_335, 25_000).discount());
    }

    @Test
    void fixedNeverExceedsSubtotal() {
        promo(PromotionType.FIXED, 50_000);
        assertEquals(50_000, svc.evaluate("SALE", 1L, 1L, 200_000, 0).discount());
        assertEquals(30_000, svc.evaluate("SALE", 1L, 1L, 30_000, 0).discount());
    }

    @Test
    void freeShipDiscountsTheShippingFeeOnly() {
        promo(PromotionType.FREE_SHIP, 0);
        ValidateResponse r = svc.evaluate("SALE", 1L, 1L, 100_000, 25_000);
        assertEquals(0, r.discount());
        assertEquals(25_000, r.shippingDiscount());
        assertEquals(25_000, r.totalDiscount());
    }

    @Test
    void minOrderIsEnforced() {
        promo(PromotionType.FIXED, 10_000).setMinOrder(100_000);
        ApiException e = assertThrows(ApiException.class, () -> svc.evaluate("SALE", 1L, 1L, 99_999, 0));
        assertEquals("PROMO_MIN_ORDER", e.getCode());
        assertEquals(10_000, svc.evaluate("SALE", 1L, 1L, 100_000, 0).discount());
    }

    @Test
    void releaseDecrementsOnlyWhenARedemptionWasDeleted() {
        when(repo.redeemedPromotionIds(5L)).thenReturn(List.of(7L));
        when(repo.deleteRedemption(7L, 5L)).thenReturn(1, 0);
        svc.release(5L);
        svc.release(5L); // retry: nothing left to delete, counter untouched
        verify(repo, times(1)).decrementUsage(7L);
    }
}
