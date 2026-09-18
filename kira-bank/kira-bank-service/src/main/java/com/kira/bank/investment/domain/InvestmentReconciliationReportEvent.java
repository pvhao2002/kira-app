package com.kira.bank.investment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

@Getter
@Setter
@Entity
@Immutable
@Table(name = "investment_reconciliation_report_events")
public class InvestmentReconciliationReportEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Long reportId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30, updatable = false)
    private InvestmentReconciliationReportStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private InvestmentReconciliationReportStatus toStatus;

    @Column(length = 2000, updatable = false)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false, updatable = false)
    private Long actorId;
}
