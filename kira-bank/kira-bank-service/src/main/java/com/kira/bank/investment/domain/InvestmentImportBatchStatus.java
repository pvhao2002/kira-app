package com.kira.bank.investment.domain;

public enum InvestmentImportBatchStatus {
    QUEUED, PROCESSING, READY, READY_WITH_ERRORS, PARTIALLY_CONFIRMED, CONFIRMED, FAILED, CANCELLED
}
