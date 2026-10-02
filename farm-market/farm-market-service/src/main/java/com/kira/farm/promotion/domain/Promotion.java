package com.kira.farm.promotion.domain;

import com.kira.farm.shared.domain.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "promotions")
public class Promotion extends BaseEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String code;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PromotionType type;
    /** Percent (0-100) for PERCENT, VND for FIXED. */
    @Column(nullable = false)
    private long value;
    @Column(nullable = false)
    private long minOrder;
    /** Optional cap on a PERCENT discount, in VND. */
    private Long maxDiscount;
    @Column(nullable = false)
    private Instant startsAt;
    @Column(nullable = false)
    private Instant endsAt;
    private Integer usageLimit;
    private Integer perUserLimit;
    @Column(nullable = false)
    private int usedCount;
    @Column(nullable = false)
    private boolean active = true;
    @Column(nullable = false)
    private boolean allBranches = true;
    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    @CollectionTable(name = "promotion_branches", joinColumns = @JoinColumn(name = "promotion_id"))
    @Column(name = "branch_id")
    private Set<Long> branchIds = new HashSet<>();
}
