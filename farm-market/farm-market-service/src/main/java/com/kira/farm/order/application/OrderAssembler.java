package com.kira.farm.order.application;

import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.order.domain.OrderItem;
import com.kira.farm.order.domain.PaymentMethod;
import com.kira.farm.order.domain.ShopOrder;
import com.kira.farm.order.infrastructure.OrderItemRepository;
import com.kira.farm.order.infrastructure.OrderStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

import static com.kira.farm.order.application.OrderDtos.*;

/** Maps orders to response DTOs (loads lines/history; no business rules). */
@Component
@RequiredArgsConstructor
class OrderAssembler {
    private final OrderItemRepository items;
    private final OrderStatusHistoryRepository history;
    private final BranchRepository branches;
    private final UserRepository users;
    private final BankPaymentProperties bank;

    OrderResponse detail(ShopOrder o) {
        List<OrderLine> lines = items.findByOrderIdOrderByIdAsc(o.getId()).stream().map(OrderLine::of).toList();
        List<HistoryEntry> trail = history.findByOrderIdOrderByIdAsc(o.getId()).stream()
            .map(h -> new HistoryEntry(h.getFromStatus(), h.getToStatus(), h.getNote(), h.getCreatedAt())).toList();
        String branchName = branches.findById(o.getBranchId()).map(Branch::getName).orElse(null);
        return new OrderResponse(o.getId(), o.getCode(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
            o.getShippingMethod(), o.getShippingFee(), o.getSubtotal(), o.getDiscount(), o.getTierDiscount(),
            o.getPointsUsed(), o.getPointsDiscount(), o.getTotal(), o.getPromoCode(), o.getVoucherCode(),
            o.getBranchId(), branchName, new ShippingAddress(o.getShipRecipient(), o.getShipPhone(), o.getShipLine1(),
            o.getShipWard(), o.getShipDistrict(), o.getShipCity()), o.getCustomerNote(), o.getTrackingCode(),
            o.getCreatedAt(), lines, trail, payment(o));
    }

    private PaymentInfo payment(ShopOrder o) {
        if (o.getPaymentMethod() != PaymentMethod.BANK_TRANSFER) return null;
        if (!bank.configured()) return new PaymentInfo(o.getPaymentMethod(), o.getPaymentStatus(), null, null, null, null, null);
        return new PaymentInfo(o.getPaymentMethod(), o.getPaymentStatus(),
            VietQr.imageUrl(bank.bin(), bank.accountNo(), bank.accountName(), o.getTotal(), o.getCode()),
            bank.displayName(), bank.accountNo(), bank.accountName(), o.getCode());
    }

    List<OrderSummary> summaries(List<ShopOrder> orders) {
        Map<Long, List<OrderItem>> byOrder = linesByOrder(orders);
        return orders.stream().map(o -> {
            List<OrderLine> lines = byOrder.getOrDefault(o.getId(), List.of()).stream().map(OrderLine::of).toList();
            return new OrderSummary(o.getId(), o.getCode(), o.getStatus(), o.getTotal(),
                lines.stream().mapToInt(OrderLine::quantity).sum(), o.getPaymentMethod(), o.getBranchId(),
                o.getCreatedAt(), lines);
        }).toList();
    }

    List<AdminOrderSummary> adminSummaries(List<ShopOrder> orders) {
        Map<Long, List<OrderItem>> byOrder = linesByOrder(orders);
        Map<Long, String> names = customerNames(orders.stream().map(ShopOrder::getUserId).collect(Collectors.toSet()));
        return orders.stream().map(o -> new AdminOrderSummary(o.getId(), o.getCode(), o.getStatus(), o.getTotal(),
            byOrder.getOrDefault(o.getId(), List.of()).stream().mapToInt(OrderItem::getQuantity).sum(),
            o.getPaymentMethod(), o.getPaymentStatus(), o.getBranchId(), o.getUserId(), names.get(o.getUserId()),
            o.getShipRecipient(), o.getCreatedAt())).toList();
    }

    Map<Long, String> customerNames(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return users.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getFullName));
    }

    private Map<Long, List<OrderItem>> linesByOrder(List<ShopOrder> orders) {
        if (orders.isEmpty()) return Map.of();
        return items.findByOrderIdInOrderByIdAsc(orders.stream().map(ShopOrder::getId).toList()).stream()
            .collect(Collectors.groupingBy(OrderItem::getOrderId));
    }
}
