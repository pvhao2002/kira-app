package com.kira.farm.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** Append-only. */
@Getter
@Setter
@Entity
@Table(name = "order_status_history")
public class OrderStatusHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long orderId;
    @Enumerated(EnumType.STRING)
    @Column(updatable = false, length = 24)
    private OrderStatus fromStatus;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 24)
    private OrderStatus toStatus;
    @Column(updatable = false)
    private Long actorUserId;
    @Column(updatable = false, length = 500)
    private String note;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
