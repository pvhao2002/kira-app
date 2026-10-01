package com.kira.farm.order.application;

import com.kira.farm.order.domain.*;
import com.kira.farm.shared.web.ApiTypes.PageMeta;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class OrderDtos {
    private OrderDtos() {
    }

    // ---- Requests -------------------------------------------------------------------------------------------

    public record CheckoutLine(@NotNull Long productId, @Min(1) @Max(999) int quantity) {
    }

    /**
     * Prices, stock and totals are always taken from the database. branchId is optional and, when sent, must match
     * the branch of the products. usePoints: 1 point = 100₫ off.
     */
    public record CheckoutRequest(
        @NotNull Long addressId,
        @NotEmpty @Size(max = 50) List<@Valid CheckoutLine> items,
        Long branchId,
        @NotNull ShippingMethod shippingMethod,
        @NotNull PaymentMethod paymentMethod,
        @Size(max = 40) String promoCode,
        @Size(max = 40) String voucherCode,
        @Min(0) @Max(10_000_000) Integer usePoints,
        @Size(max = 500) String customerNote) {
    }

    /** trackingCode is required when moving to SHIPPING. */
    public record StatusRequest(@NotNull OrderStatus status, @Size(max = 64) String trackingCode,
                                @Size(max = 500) String note) {
    }

    public record NoteRequest(@NotBlank(message = "Vui lòng nhập ghi chú") @Size(max = 1000) String body) {
    }

    // ---- Responses ------------------------------------------------------------------------------------------

    public record OrderLine(Long productId, String sku, String name, String unit, long unitPrice, int quantity,
                            long lineTotal) {
        public static OrderLine of(OrderItem i) {
            return new OrderLine(i.getProductId(), i.getSku(), i.getProductName(), i.getUnit(), i.getUnitPrice(),
                i.getQuantity(), i.getLineTotal());
        }
    }

    public record ShippingAddress(String recipient, String phone, String line1, String ward, String district,
                                  String city) {
    }

    public record HistoryEntry(OrderStatus from, OrderStatus to, String note, Instant at) {
    }

    /**
     * Payment block of BANK_TRANSFER orders. qrUrl/bankName/accountNo/accountName are null until the shop bank
     * account is configured; transferNote (the order code) is what the customer must put in the transfer content.
     */
    public record PaymentInfo(PaymentMethod method, PaymentStatus status, String qrUrl, String bankName,
                              String accountNo, String accountName, String transferNote) {
    }

    /** status PAID | UNPAID; note is optional and is stored as an internal order note. */
    public record PaymentRequest(@NotNull PaymentStatus status, @Size(max = 300) String note) {
    }

    /**
     * total = subtotal + shippingFee - discount (promo/voucher) - tierDiscount - pointsDiscount.
     * Staff notes are never part of this customer-facing view.
     */
    public record OrderResponse(Long id, String code, OrderStatus status, PaymentMethod paymentMethod,
                                PaymentStatus paymentStatus, ShippingMethod shippingMethod, long shippingFee,
                                long subtotal, long discount, long tierDiscount, int pointsUsed, long pointsDiscount,
                                long total, String promoCode, String voucherCode, Long branchId, String branchName,
                                ShippingAddress shipping, String customerNote, String trackingCode, Instant createdAt,
                                List<OrderLine> items, List<HistoryEntry> history, PaymentInfo payment) {
    }

    public record OrderSummary(Long id, String code, OrderStatus status, long total, int itemCount,
                               PaymentMethod paymentMethod, Long branchId, Instant createdAt, List<OrderLine> items) {
    }

    public record AdminOrderSummary(Long id, String code, OrderStatus status, long total, int itemCount,
                                    PaymentMethod paymentMethod, PaymentStatus paymentStatus, Long branchId,
                                    Long customerId, String customerName, String recipient, Instant createdAt) {
    }

    /** data + page meta + counts per status (same filters, ignoring the status filter). */
    public record AdminOrderList(List<AdminOrderSummary> data, PageMeta meta, Map<OrderStatus, Long> counts) {
    }

    public record NoteResponse(Long id, Long authorUserId, String authorName, String body, Instant createdAt) {
    }

    public record AdminOrderDetail(OrderResponse order, Long customerId, String customerName,
                                   List<NoteResponse> notes) {
    }

    public record ReorderLine(Long productId, String slug, String name, String imageUrl, String unit, long unitPrice,
                              int quantity, int requestedQuantity, int available) {
    }

    public record ReorderSkipped(Long productId, String name, String reason) {
    }

    /** Lines that can be re-added to the cart right now (quantity is capped at current stock). */
    public record ReorderResponse(Long branchId, List<ReorderLine> lines, List<ReorderSkipped> skipped) {
    }
}
