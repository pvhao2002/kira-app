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
@Table(name = "investment_transaction_import_items")
public class InvestmentTransactionImportItem extends AuditedEntity {
    @Column(nullable = false, unique = true, length = 36, columnDefinition = "CHAR(36)")
    private String itemId;
    @Column(nullable = false)
    private Long batchId;
    @Column(nullable = false)
    private Long primaryAttachmentId;
    private Long matchedTransactionId;
    private Long confirmedTransactionId;
    @Enumerated(EnumType.STRING)
    private InvestmentTransactionType transactionType;
    @Enumerated(EnumType.STRING)
    private InvestmentTransactionStatus transactionStatus;
    @Column(precision = 19, scale = 4)
    private BigDecimal amount;
    @Column(length = 3, columnDefinition = "CHAR(3)")
    private String currency;
    private Instant transactionAt;
    @Column(length = 150)
    private String externalTransactionId;
    @Column(length = 1000)
    private String description;
    @Column(length = 1000)
    private String normalizedDescription;
    @Column(columnDefinition = "TEXT")
    private String rawText;
    @Column(columnDefinition = "JSON")
    private String aiExtractionData;
    @Column(precision = 5, scale = 4)
    private BigDecimal aiConfidence;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentProcessingAction processingAction;
    @Enumerated(EnumType.STRING)
    private InvestmentImportResolution resolution;
    @Column(columnDefinition = "JSON")
    private String warnings;
    @Column(columnDefinition = "BINARY(32)")
    private byte[] deduplicationKey;
}
