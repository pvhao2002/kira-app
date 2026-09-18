package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentTransactionType;

import java.math.BigDecimal;

public record InvestmentTypeSummary(InvestmentTransactionType transactionType, long count, BigDecimal amount) {
}
