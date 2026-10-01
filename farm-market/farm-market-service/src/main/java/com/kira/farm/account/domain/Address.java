package com.kira.farm.account.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/** A customer's saved delivery address. Contains personal data: never log it. */
@Getter
@Setter
@Entity
@Table(name = "addresses")
public class Address {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, length = 40)
    private String label;
    @Column(nullable = false, length = 120)
    private String recipient;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(nullable = false)
    private String line1;
    @Column(length = 80)
    private String ward;
    @Column(length = 80)
    private String district;
    @Column(length = 80)
    private String city;
    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;
    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;
    private Long nearestBranchId;
    @Column(name = "is_default", nullable = false)
    private boolean defaultAddress;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
