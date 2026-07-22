package com.kira.bank.investment.domain;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.*;
@Getter @Setter @Entity @Table(name="investment_withdrawals")
public class InvestmentWithdrawal extends AuditedEntity {
 private Long userId,investmentAccountId; private Instant requestedDate; private BigDecimal requestedAmount,withdrawalFee,expectedNetAmount,actualNetAmount; private String destinationAccount,referenceNumber; private LocalDate expectedReceiveDate,actualReceiveDate; private String status; private Long attachmentId; @Column(columnDefinition="TEXT") private String note; private String idempotencyKey;
}

