package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "credit_card_cashback_programs")
public class CreditCardCashbackProgram extends AuditedEntity {
    private Long userCardId;
    @Column(length = 150, nullable = false)
    private String name;
    @Column(columnDefinition = "TEXT")
    private String notes;
    @Column(length = 500)
    private String termsUrl;
    private boolean active = true;
}
