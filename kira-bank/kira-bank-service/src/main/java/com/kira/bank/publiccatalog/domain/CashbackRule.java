package com.kira.bank.publiccatalog.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "cashback_rules")
public class CashbackRule extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_catalog_id")
    private CardCatalog cardCatalog;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mcc_id")
    private Mcc mcc;
    private String mccGroup;
    private BigDecimal cashbackRate;
    private BigDecimal cashbackCap;
    private BigDecimal minimumSpending;
    private BigDecimal eligibleAmountLimit;
    private String limitCycle;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    @Column(name = "conditions_text", columnDefinition = "TEXT")
    private String conditions;
    @Column(name = "exclusions_text", columnDefinition = "TEXT")
    private String exclusions;
    private boolean active;
}

