package com.kira.bank.investment.domain;

public enum InvestmentReconciliationReportStatus {
    OPEN,
    IN_REVIEW,
    NEEDS_INFO,
    RESOLVED,
    REJECTED;

    public boolean closed() {
        return this == RESOLVED || this == REJECTED;
    }
}
