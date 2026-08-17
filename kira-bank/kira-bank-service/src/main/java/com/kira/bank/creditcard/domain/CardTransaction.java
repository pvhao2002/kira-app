package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "card_transactions")
public class CardTransaction extends AuditedEntity {
    private Long userId, userCardId;
    private Instant transactionDate, postedDate;
    private Long merchantId, mccId;
    private BigDecimal amount;
    private String currency = "VND";
    private BigDecimal originalAmount;
    private String originalCurrency, description, referenceNumber;
    private BigDecimal expectedCashback = BigDecimal.ZERO;
    private String status = "POSTED";
    private Long attachmentId;
    @Column(columnDefinition = "TEXT")
    private String note;
}

