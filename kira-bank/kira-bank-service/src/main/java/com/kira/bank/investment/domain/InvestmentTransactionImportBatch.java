package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_transaction_import_batches")
public class InvestmentTransactionImportBatch extends AuditedEntity {
    @Column(nullable = false, unique = true, length = 36, columnDefinition = "CHAR(36)")
    private String batchId;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private Long investmentAccountId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentImportBatchStatus status = InvestmentImportBatchStatus.QUEUED;
    private int fileCount;
    private int detectedCount;
    private int insertedCount;
    private int updatedCount;
    private int skippedCount;
    private int failedCount;
    private int reviewCount;
    private Instant completedAt;
    private Instant retentionUntil;
}
