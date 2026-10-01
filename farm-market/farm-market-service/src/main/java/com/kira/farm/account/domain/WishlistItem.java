package com.kira.farm.account.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "wishlist_items")
@IdClass(WishlistItem.Key.class)
public class WishlistItem {
    @Id
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Id
    @Column(nullable = false, updatable = false)
    private Long productId;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private Long userId;
        private Long productId;
    }
}
