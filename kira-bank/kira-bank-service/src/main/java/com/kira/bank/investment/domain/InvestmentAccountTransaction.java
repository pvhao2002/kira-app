package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_account_transactions")
public class InvestmentAccountTransaction extends AuditedEntity {
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private Long investmentAccountId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentTransactionType transactionType;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentTransactionStatus transactionStatus;
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;
    @Column(nullable = false, length = 3, columnDefinition = "CHAR(3)")
    private String currency;
    @Column(nullable = false)
    private Instant transactionAt;
    @Column(length = 150)
    private String externalTransactionId;
    @Column(length = 1000)
    private String description;
    @Column(columnDefinition = "TEXT")
    private String rawText;
    @Column(columnDefinition = "JSON")
    private String aiExtractionData;
    @Column(precision = 5, scale = 4)
    private BigDecimal aiConfidence;
    @Column(nullable = false, columnDefinition = "BINARY(32)")
    private byte[] deduplicationKey;
    @Column(length = 64, columnDefinition = "CHAR(64)")
    private String sourceFileHash;
    private Long sourceAttachmentId;
}
