package com.kira.farm.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Stock of one product in its branch. Rows are mutated ONLY through conditional UPDATE statements in
 * InventoryRepository (never by setting fields on a loaded entity), so concurrent orders cannot oversell.
 */
@Getter
@Setter
@Entity
@Table(name = "inventory")
public class InventoryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long branchId;
    @Column(nullable = false, updatable = false)
    private Long productId;
    @Column(nullable = false)
    private int onHand;
    @Column(nullable = false)
    private int reserved;
    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public int available() {
        return onHand - reserved;
    }
}
