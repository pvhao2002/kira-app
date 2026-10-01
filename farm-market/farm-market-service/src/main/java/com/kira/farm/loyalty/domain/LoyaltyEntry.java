package com.kira.farm.loyalty.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Append-only points ledger row (read model). Rows are written only through LoyaltyRepository's INSERT IGNORE so
 * the UNIQUE(ref_type, ref_id, reason) key makes every award/spend idempotent.
 */
@Getter
@Setter
@Entity
@Table(name = "loyalty_ledger")
public class LoyaltyEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, updatable = false)
    private int delta;
    @Column(nullable = false, updatable = false, length = 32)
    private String reason;
    @Column(nullable = false, updatable = false, length = 32)
    private String refType;
    @Column(nullable = false, updatable = false, length = 64)
    private String refId;
    @Column(updatable = false)
    private Instant expiresAt;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
