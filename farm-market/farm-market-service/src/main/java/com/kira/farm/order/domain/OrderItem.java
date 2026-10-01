package com.kira.farm.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Immutable price snapshot of one order line. */
@Getter
@Setter
@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long orderId;
    @Column(nullable = false, updatable = false)
    private Long productId;
    @Column(nullable = false, updatable = false, length = 40)
    private String sku;
    @Column(nullable = false, updatable = false, length = 200)
    private String productName;
    @Column(nullable = false, updatable = false, length = 20)
    private String unit;
    @Column(nullable = false, updatable = false)
    private long unitPrice;
    @Column(nullable = false, updatable = false)
    private int quantity;
    @Column(nullable = false, updatable = false)
    private long lineTotal;
}
