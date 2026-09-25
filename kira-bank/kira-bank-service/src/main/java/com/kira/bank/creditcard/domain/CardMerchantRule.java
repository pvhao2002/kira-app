package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** A user's "description contains pattern → MCC" rule applied to imported and manual card transactions. */
@Getter
@Setter
@Entity
@Table(name = "card_merchant_rules")
public class CardMerchantRule extends AuditedEntity {
    private Long userId;
    @Column(length = 100, nullable = false)
    private String pattern;
    @Column(length = 4, columnDefinition = "CHAR(4)", nullable = false)
    private String mccCode;
    @Column(length = 150)
    private String label;
}
