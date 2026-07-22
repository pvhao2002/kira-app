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
@Table(name = "discount_invoices")
public class DiscountInvoice extends AuditedEntity {
    private Long userId, userCardId, merchantId, serviceProviderId;
    private String invoiceNumber;
    private LocalDate invoiceDate;
    private BigDecimal invoiceAmount, amountPaid, serviceDiscountRate, serviceDiscountAmount, additionalFee, cashbackRate, expectedCashback, actualCashback;
    private LocalDate expectedReceiveDate, actualReceiveDate;
    private BigDecimal expectedProfit, actualProfit, capitalLocked;
    private String status;
    private Long attachmentId;
    @Column(columnDefinition = "TEXT")
    private String note;
}

