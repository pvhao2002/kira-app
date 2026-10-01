package com.kira.farm.order.domain;

import com.kira.farm.shared.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Customer order (table orders). total = subtotal + shippingFee - discount - tierDiscount - pointsDiscount.
 * Named ShopOrder because ORDER is a reserved word in JPQL.
 */
@Getter
@Setter
@Entity
@Table(name = "orders")
public class ShopOrder extends BaseEntity {
    @Column(nullable = false, updatable = false, length = 24)
    private String code;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, updatable = false)
    private Long branchId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private OrderStatus status = OrderStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PaymentMethod paymentMethod;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ShippingMethod shippingMethod;
    @Column(nullable = false)
    private long shippingFee;
    @Column(nullable = false)
    private long subtotal;
    /** Promotion + voucher discount (goods and shipping). */
    @Column(nullable = false)
    private long discount;
    @Column(nullable = false)
    private long tierDiscount;
    @Column(nullable = false)
    private int pointsUsed;
    @Column(nullable = false)
    private long pointsDiscount;
    @Column(nullable = false)
    private long total;
    @Column(length = 40)
    private String promoCode;
    @Column(length = 40)
    private String voucherCode;
    @Column(nullable = false, length = 120)
    private String shipRecipient;
    @Column(nullable = false, length = 20)
    private String shipPhone;
    @Column(nullable = false)
    private String shipLine1;
    @Column(length = 80)
    private String shipWard;
    @Column(length = 80)
    private String shipDistrict;
    @Column(length = 80)
    private String shipCity;
    @Column(length = 500)
    private String customerNote;
    @Column(nullable = false, updatable = false, length = 64)
    private String idempotencyKey;
    @Column(length = 64)
    private String trackingCode;
}
