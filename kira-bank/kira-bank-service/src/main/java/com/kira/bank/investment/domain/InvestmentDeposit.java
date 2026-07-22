package com.kira.bank.investment.domain;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;
@Getter @Setter @Entity @Table(name="investment_deposits")
public class InvestmentDeposit extends AuditedEntity {
 private Long userId; private Long investmentAccountId; private Instant depositDate; private BigDecimal amount; private BigDecimal fee; private BigDecimal netReceivedAmount; private String paymentMethod; private String referenceNumber; private String status; private Long attachmentId; @Column(columnDefinition="TEXT") private String note; private String idempotencyKey;
}

