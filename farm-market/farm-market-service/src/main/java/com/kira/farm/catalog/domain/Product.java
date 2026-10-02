package com.kira.farm.catalog.domain;

import com.kira.farm.shared.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** A branch-scoped product. Money is whole VND. */
@Getter
@Setter
@Entity
@Table(name = "products")
public class Product extends BaseEntity {
    @Column(nullable = false, updatable = false)
    private Long branchId;
    private Long groupId;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;
    @Column(nullable = false, length = 40)
    private String sku;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, unique = true, length = 220)
    private String slug;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Column(length = 160)
    private String origin;
    @Column(length = 500)
    private String imageUrl;
    @Column(length = 40)
    private String badge;
    @Column(nullable = false)
    private long price;
    private Long oldPrice;
    @Column(nullable = false, length = 20)
    private String unit;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ProductStatus status = ProductStatus.ACTIVE;
    @Column(nullable = false)
    private boolean suggestToOtherBranches = true;
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal ratingAvg = BigDecimal.ZERO;
    @Column(nullable = false)
    private int reviewCount;
    @Column(nullable = false)
    private int soldCount;
}
