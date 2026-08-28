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
@Table(name = "credit_card_cashback_rule_mccs")
public class CreditCardCashbackRuleMcc extends AuditedEntity {
    private Long ruleId;
    @Column(length = 4, columnDefinition = "CHAR(4)", nullable = false)
    private String mccCode;
}
