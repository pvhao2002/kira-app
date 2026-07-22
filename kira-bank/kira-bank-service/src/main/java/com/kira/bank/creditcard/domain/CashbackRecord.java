package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "cashback_records")
public class CashbackRecord extends AuditedEntity {
    private Long userId, transactionId, userCardId, bankId, mccId;
    private BigDecimal eligibleAmount, cashbackRate, expectedCashback, actualCashback;
    private LocalDate expectedReceiveDate, actualReceiveDate;
    private Long statementId;
    private String status, reason;
    @Column(columnDefinition = "TEXT")
    private String note;
}

