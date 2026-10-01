package com.kira.farm.order;

import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.loyalty.infrastructure.VoucherRepository;
import com.kira.farm.order.application.OrderWorkflow;
import com.kira.farm.order.domain.*;
import com.kira.farm.order.infrastructure.OrderItemRepository;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.order.infrastructure.OrderStatusHistoryRepository;
import com.kira.farm.promotion.application.PromotionService;
import com.kira.farm.shared.security.AuthPrincipal;
import com.kira.farm.shared.web.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CancelRefundTest {
    OrderRepository orders = mock(OrderRepository.class);
    OrderItemRepository items = mock(OrderItemRepository.class);
    OrderStatusHistoryRepository history = mock(OrderStatusHistoryRepository.class);
    InventoryService inventory = mock(InventoryService.class);
    LoyaltyService loyalty = mock(LoyaltyService.class);
    ProductRepository products = mock(ProductRepository.class);
    VoucherRepository vouchers = mock(VoucherRepository.class);
    PromotionService promotions = mock(PromotionService.class);
    OrderWorkflow workflow = new OrderWorkflow(orders, items, history, inventory, loyalty, products, vouchers, promotions);

    @BeforeEach
    void login() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new AuthPrincipal(9L, Role.CUSTOMER, Set.of()), null, List.of()));
    }

    @AfterEach
    void logout() {
        SecurityContextHolder.clearContext();
    }

    ShopOrder order(OrderStatus status) {
        ShopOrder o = new ShopOrder();
        o.setId(5L);
        o.setCode("DN-260101-0001");
        o.setUserId(9L);
        o.setBranchId(2L);
        o.setStatus(status);
        o.setPointsUsed(40);
        o.setPaymentMethod(PaymentMethod.COD);
        return o;
    }

    @Test
    void cancelRefundsPointsVoucherAndPromotionAndReleasesStock() {
        OrderItem line = new OrderItem();
        line.setProductId(11L);
        line.setQuantity(3);
        when(items.findByOrderIdOrderByIdAsc(5L)).thenReturn(List.of(line));

        workflow.apply(order(OrderStatus.CONFIRMED), OrderStatus.CANCELLED, null, "x");

        verify(inventory).release(2L, 11L, 3);
        verify(loyalty).refundForOrder(9L, 40, "DN-260101-0001");
        verify(vouchers).release(5L);
        verify(promotions).release(5L);
        verify(loyalty, never()).awardPurchase(any(), any(), anyLong());
    }

    @Test
    void secondCancelIsRejectedAndRefundsNothingMore() {
        when(items.findByOrderIdOrderByIdAsc(5L)).thenReturn(List.of());
        ShopOrder o = order(OrderStatus.PENDING);
        workflow.apply(o, OrderStatus.CANCELLED, null, null);
        ApiException e = assertThrows(ApiException.class, () -> workflow.apply(o, OrderStatus.CANCELLED, null, null));
        assertEquals("ORDER_INVALID_TRANSITION", e.getCode());
        verify(loyalty, times(1)).refundForOrder(anyLong(), anyInt(), anyString());
        verify(vouchers, times(1)).release(5L);
        verify(promotions, times(1)).release(5L);
    }

    @Test
    void deliveredOrderCannotBeCancelledSoNothingIsRefunded() {
        ApiException e = assertThrows(ApiException.class,
            () -> workflow.apply(order(OrderStatus.DELIVERED), OrderStatus.CANCELLED, null, null));
        assertEquals("ORDER_INVALID_TRANSITION", e.getCode());
        verifyNoInteractions(loyalty, vouchers, promotions);
    }
}
