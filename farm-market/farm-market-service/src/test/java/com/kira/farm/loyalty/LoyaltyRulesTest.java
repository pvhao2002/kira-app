package com.kira.farm.loyalty;

import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.loyalty.infrastructure.LoyaltyRepository;
import com.kira.farm.loyalty.infrastructure.VoucherRepository;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.loyalty.application.LoyaltyProperties;
import com.kira.farm.loyalty.application.LoyaltyProperties.Reward;
import com.kira.farm.promotion.domain.PromotionType;
import com.kira.farm.shared.security.AuthPrincipal;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LoyaltyRulesTest {
    /** Same values as the defaults in application.yml. */
    private static LoyaltyProperties props() {
        return new LoyaltyProperties(List.of(
            new Reward("voucher-20k", "Voucher giảm 20.000₫", "d", 200, PromotionType.FIXED, 20_000, 100_000, 60),
            new Reward("freeship", "Miễn phí vận chuyển", "d", 300, PromotionType.FREE_SHIP, 0, 0, 60)));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    private static void loginAs(long userId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new AuthPrincipal(userId, Role.CUSTOMER, Set.of()), null, List.of()));
    }

    @Test
    void tierThresholds() {
        assertEquals(Tier.DONG, Tier.of(0));
        assertEquals(Tier.DONG, Tier.of(499));
        assertEquals(Tier.BAC, Tier.of(500));
        assertEquals(Tier.VANG, Tier.of(1500));
        assertEquals(Tier.KIM_CUONG, Tier.of(4000));
        assertEquals(Tier.KIM_CUONG, Tier.of(999_999));
        assertEquals(Tier.BAC, Tier.DONG.next());
        assertNull(Tier.KIM_CUONG.next());
    }

    @Test
    void tierDiscountPercentagesRoundHalfUp() {
        assertEquals(0, Tier.DONG.discount(1_000_000));
        assertEquals(0, Tier.BAC.discount(1_000_000));
        assertEquals(30_000, Tier.VANG.discount(1_000_000));
        assertEquals(80_000, Tier.KIM_CUONG.discount(1_000_000));
        assertEquals(2, Tier.VANG.discount(50));   // 1.5 -> 2
        assertEquals(1, Tier.VANG.discount(49));   // 1.47 -> 1
        assertEquals(0, Tier.VANG.discount(-5));
        assertTrue(Tier.KIM_CUONG.freeFastDelivery());
        assertFalse(Tier.VANG.freeFastDelivery());
    }

    @Test
    void purchaseAwardsOnePointPerTenThousand() {
        LoyaltyRepository ledger = mock(LoyaltyRepository.class);
        LoyaltyService svc = new LoyaltyService(ledger, mock(VoucherRepository.class), mock(UserRepository.class), props());
        svc.awardPurchase(1L, "DN-1", 129_999);
        verify(ledger).insertExpiring(eq(1L), eq(12), eq("PURCHASE"), eq("ORDER"), eq("DN-1"), any());
        svc.awardPurchase(1L, "DN-2", 9_999); // under one point: nothing written
        verify(ledger, never()).insertExpiring(anyLong(), anyInt(), anyString(), anyString(), eq("DN-2"), any());
    }

    @Test
    void refundIsIdempotentViaLedgerUniqueKey() {
        LoyaltyRepository ledger = mock(LoyaltyRepository.class);
        LoyaltyService svc = new LoyaltyService(ledger, mock(VoucherRepository.class), mock(UserRepository.class), props());
        when(ledger.insertPermanent(1L, 40, "ORDER_CANCEL_REFUND", "ORDER", "DN-1")).thenReturn(1, 0);
        assertTrue(svc.refundForOrder(1L, 40, "DN-1"));
        assertFalse(svc.refundForOrder(1L, 40, "DN-1")); // retry: unique key ignores the second insert
        assertFalse(svc.refundForOrder(1L, 0, "DN-1"));
        verify(ledger, times(2)).insertPermanent(1L, 40, "ORDER_CANCEL_REFUND", "ORDER", "DN-1");
    }

    @Test
    void changedConfigIsHonouredByRewardsAndRedeem() {
        LoyaltyRepository ledger = mock(LoyaltyRepository.class);
        VoucherRepository vouchers = mock(VoucherRepository.class);
        when(vouchers.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        when(ledger.balance(eq(7L), any())).thenReturn(150L);
        when(ledger.insertPermanent(anyLong(), anyInt(), anyString(), anyString(), anyString())).thenReturn(1);
        var custom = new LoyaltyProperties(List.of(
            new Reward("tea", "Trà miễn phí", "d", 120, PromotionType.PERCENT, 10, 50_000, 7)));
        UserRepository users = mock(UserRepository.class);
        when(users.findForUpdate(7L)).thenReturn(java.util.Optional.of(mock(com.kira.farm.identity.domain.User.class)));
        LoyaltyService svc = new LoyaltyService(ledger, vouchers, users, custom);
        loginAs(7);

        var rewards = svc.rewards();
        assertEquals(1, rewards.size());
        assertEquals("tea", rewards.get(0).id());
        assertEquals("Trà miễn phí", rewards.get(0).title());
        assertEquals(120, rewards.get(0).pointsCost());
        assertTrue(rewards.get(0).affordable()); // 150 >= 120, would not hold for the 200-point default

        var v = svc.redeem("tea", "redeem-key-1");
        assertEquals(PromotionType.PERCENT, v.discountType());
        assertEquals(10, v.value());
        assertEquals(50_000, v.minOrder());
        assertEquals(120, v.pointsCost());
        verify(ledger).insertPermanent(eq(7L), eq(-120), eq("REWARD"), eq("VOUCHER"), anyString());
        assertEquals("REWARD_NOT_FOUND", assertThrows(ApiException.class, () -> svc.redeem("voucher-20k", "redeem-key-2")).getCode());
    }

    @Test
    void invalidRewardConfigFailsFast() {
        var ok = new Reward("a", "A", "d", 10, PromotionType.FIXED, 1, 0, 1);
        assertThrows(IllegalArgumentException.class, () -> new LoyaltyProperties(List.of(ok, ok)));            // duplicate id
        assertThrows(IllegalArgumentException.class, () -> new Reward("b", "B", "d", 0, PromotionType.FIXED, 1, 0, 1)); // cost
        assertThrows(IllegalArgumentException.class, () -> new Reward("b", "B", "d", 5, PromotionType.PERCENT, 101, 0, 1));
        assertThrows(IllegalArgumentException.class, () -> new Reward("b", "B", "d", 5, PromotionType.FIXED, 1, 0, 0));
    }
}
