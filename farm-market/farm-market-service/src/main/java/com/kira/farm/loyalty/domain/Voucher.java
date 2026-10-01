package com.kira.farm.loyalty.domain;

import com.kira.farm.promotion.domain.PromotionType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** A personal voucher bought with points. Marked USED only through VoucherRepository.markUsed. */
@Getter
@Setter
@Entity
@Table(name = "vouchers")
public class Voucher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, updatable = false, unique = true, length = 40)
    private String code;
    @Column(nullable = false, updatable = false, length = 160)
    private String title;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private PromotionType discountType;
    @Column(nullable = false, updatable = false)
    private long value;
    @Column(nullable = false, updatable = false)
    private long minOrder;
    @Column(nullable = false, updatable = false)
    private int pointsCost;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private VoucherStatus status = VoucherStatus.AVAILABLE;
    private Instant expiresAt;
    private Long usedOrderId;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public boolean usableAt(Instant now) {
        return status == VoucherStatus.AVAILABLE && (expiresAt == null || expiresAt.isAfter(now));
    }

    /** Status as shown to the customer (AVAILABLE past its expiry reads as EXPIRED). */
    public VoucherStatus effectiveStatus(Instant now) {
        return status == VoucherStatus.AVAILABLE && expiresAt != null && !expiresAt.isAfter(now)
            ? VoucherStatus.EXPIRED : status;
    }
}
