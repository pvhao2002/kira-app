package com.kira.bank.investment.domain;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;
@Getter @Setter @Entity @Table(name="investment_tasks")
public class InvestmentTask extends AuditedEntity {
 private Long userId; private Long investmentAccountId; private String taskCode; private String taskName; private String taskType; private Instant startDate; private Instant expectedCompletionDate; private Instant actualCompletionDate;
 private BigDecimal allocatedCapital=BigDecimal.ZERO, expectedCapitalReturn=BigDecimal.ZERO, expectedProfit=BigDecimal.ZERO, expectedReward=BigDecimal.ZERO, actualCapitalReturn=BigDecimal.ZERO, actualProfit=BigDecimal.ZERO, actualReward=BigDecimal.ZERO;
 private String status; @Column(columnDefinition="TEXT") private String description; private Long attachmentId; @Column(columnDefinition="TEXT") private String note; private String idempotencyKey;
}

