package com.kira.farm.order.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** Internal staff note; never shown to the customer. */
@Getter
@Setter
@Entity
@Table(name = "order_notes")
public class OrderNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long orderId;
    @Column(nullable = false, updatable = false)
    private Long authorUserId;
    @Column(nullable = false, updatable = false, length = 1000)
    private String body;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
