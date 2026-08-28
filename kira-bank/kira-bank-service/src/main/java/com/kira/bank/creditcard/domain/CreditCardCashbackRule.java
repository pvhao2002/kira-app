package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "credit_card_cashback_rules")
public class CreditCardCashbackRule extends AuditedEntity {
    private Long programId;
    @Column(length = 150, nullable = false)
    private String categoryName;
    private int displayOrder;
    @Column(precision = 7, scale = 4, nullable = false)
    private BigDecimal cashbackRate;
    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal maxCashbackAmount;
}
