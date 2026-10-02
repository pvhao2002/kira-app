package com.kira.farm.order.application;

import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.loyalty.infrastructure.VoucherRepository;
import com.kira.farm.order.domain.*;
import com.kira.farm.promotion.application.PromotionService;
import com.kira.farm.order.infrastructure.OrderItemRepository;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.order.infrastructure.OrderStatusHistoryRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * The only place an order changes status. Callers load the order with orders.findForUpdateByCode (row lock),
 * authorise it, then call apply inside the same transaction.
 * Stock stays reserved until DELIVERED (commit) or CANCELLED (release).
 */
@Component
@RequiredArgsConstructor
public class OrderWorkflow {
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final OrderStatusHistoryRepository history;
    private final InventoryService inventory;
    private final LoyaltyService loyalty;
    private final ProductRepository products;
    private final VoucherRepository vouchers;
    private final PromotionService promotions;

    @Transactional
    public void apply(ShopOrder o, OrderStatus to, String trackingCode, String note) {
        OrderStatus from = o.getStatus();
        if (!from.canMoveTo(to))
            throw ApiException.conflict("ORDER_INVALID_TRANSITION", "Không thể chuyển đơn hàng sang trạng thái này");
        if (to == OrderStatus.SHIPPING) {
            if (trackingCode == null || trackingCode.isBlank())
                throw ApiException.unprocessable("TRACKING_REQUIRED", "Vui lòng nhập mã vận đơn khi giao hàng");
            o.setTrackingCode(trackingCode.trim());
        }
        o.setStatus(to);
        if (to == OrderStatus.DELIVERED && o.getPaymentMethod() == PaymentMethod.COD)
            o.setPaymentStatus(PaymentStatus.PAID);
        orders.saveAndFlush(o);

        // Stock operations clear the persistence context, so everything needed afterwards is copied out first.
        Long orderId = o.getId();
        Long branchId = o.getBranchId();
        Long userId = o.getUserId();
        String code = o.getCode();
        long total = o.getTotal();
        int pointsUsed = o.getPointsUsed();
        List<OrderItem> lines = items.findByOrderIdOrderByIdAsc(orderId);
        if (to == OrderStatus.CANCELLED) {
            for (OrderItem l : lines) inventory.release(branchId, l.getProductId(), l.getQuantity());
            // Same transaction, each step idempotent: points ledger unique key, voucher USED->AVAILABLE, redemption delete.
            loyalty.refundForOrder(userId, pointsUsed, code);
            vouchers.release(orderId);
            promotions.release(orderId);
        } else if (to == OrderStatus.DELIVERED) {
            for (OrderItem l : lines) {
                inventory.commit(branchId, l.getProductId(), l.getQuantity(), "ORDER", code);
                products.incrementSold(l.getProductId(), l.getQuantity());
            }
            loyalty.awardPurchase(userId, code, total);
        }
        record(orderId, from, to, note);
    }

    public OrderStatusHistory record(Long orderId, OrderStatus from, OrderStatus to, String note) {
        OrderStatusHistory h = new OrderStatusHistory();
        h.setOrderId(orderId);
        h.setFromStatus(from);
        h.setToStatus(to);
        h.setActorUserId(CurrentUser.id());
        h.setNote(note == null || note.isBlank() ? null : note.trim());
        return history.save(h);
    }
}
