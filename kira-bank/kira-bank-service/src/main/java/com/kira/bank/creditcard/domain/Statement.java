package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "statements")
public class Statement extends AuditedEntity {
    private Long userId, userCardId;
    private LocalDate periodStart, periodEnd, statementDate, dueDate;
    private BigDecimal openingBalance = BigDecimal.ZERO, totalSpending = BigDecimal.ZERO, totalRefund = BigDecimal.ZERO, totalFee = BigDecimal.ZERO, totalInterest = BigDecimal.ZERO, minimumPayment = BigDecimal.ZERO, statementBalance, expectedCashback = BigDecimal.ZERO, actualCashback = BigDecimal.ZERO, paidAmount = BigDecimal.ZERO, remainingAmount;
    private String status = "OPEN";
    private Long attachmentId;
    @Column(columnDefinition = "TEXT")
    private String note;
}

