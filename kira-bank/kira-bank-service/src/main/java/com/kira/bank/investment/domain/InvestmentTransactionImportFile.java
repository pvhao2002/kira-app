package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "investment_transaction_import_files")
public class InvestmentTransactionImportFile extends AuditedEntity {
    @Column(nullable = false)
    private Long batchId;
    @Column(nullable = false)
    private Long attachmentId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentImportFileStatus status = InvestmentImportFileStatus.PENDING;
    @Column(length = 100)
    private String errorCode;
}
