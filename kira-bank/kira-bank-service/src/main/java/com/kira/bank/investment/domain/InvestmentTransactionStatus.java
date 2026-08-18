package com.kira.bank.investment.domain;

public enum InvestmentTransactionStatus {
    PENDING, COMPLETED, FAILED, CANCELLED;

    public boolean terminal() {
        return this != PENDING;
    }
}
