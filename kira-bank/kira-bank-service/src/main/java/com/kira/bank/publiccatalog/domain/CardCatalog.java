package com.kira.bank.publiccatalog.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "credit_card_catalogs")
public class CardCatalog extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bank_id")
    private Bank bank;
    private String cardName;
    private String cardCode;
    private String cardNetwork;
    private String cardTier;
    private String cardType;
    private BigDecimal annualFee;
    private String currency;
    private BigDecimal cashbackLimit;
    private Integer defaultStatementDay;
    private Integer defaultDueDay;
    private String minimumPaymentRule;
    @Column(columnDefinition = "TEXT")
    private String cashbackCondition;
    @Column(columnDefinition = "TEXT")
    private String description;
    private String termsUrl;
    private String imageUrl;
    private boolean active;
}

