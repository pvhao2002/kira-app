package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_reconciliation_reports")
public class InvestmentReconciliationReport extends AuditedEntity {
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private Long investmentAccountId;
    @Column(nullable = false)
    private Long transactionId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private InvestmentReconciliationReportReason reason;
    @Column(nullable = false, length = 1000)
    private String detail;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InvestmentReconciliationReportStatus status = InvestmentReconciliationReportStatus.OPEN;
    @Column(columnDefinition = "TEXT")
    private String resolutionNote;
    private Instant resolvedAt;
}
