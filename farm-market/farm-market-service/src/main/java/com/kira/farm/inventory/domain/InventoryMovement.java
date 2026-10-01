package com.kira.farm.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** Append-only stock ledger row: insert only, never update or delete. */
@Getter
@Setter
@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long branchId;
    @Column(nullable = false, updatable = false)
    private Long productId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private MovementType type;
    @Column(nullable = false, updatable = false)
    private int delta;
    @Column(nullable = false, updatable = false)
    private int onHandAfter;
    @Column(updatable = false)
    private String reason;
    @Column(updatable = false, length = 32)
    private String refType;
    @Column(updatable = false, length = 64)
    private String refId;
    @Column(updatable = false)
    private Long actorUserId;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
