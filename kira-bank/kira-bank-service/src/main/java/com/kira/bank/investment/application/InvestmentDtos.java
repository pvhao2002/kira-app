package com.kira.bank.investment.application;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
public final class InvestmentDtos { private InvestmentDtos(){}
 public record CreateAccountRequest(@NotNull Long platformId,@NotBlank @Size(max=150)String accountName,@Size(max=100)String externalAccountCode,@Pattern(regexp="[A-Z]{3}")String currency,@Size(max=1000)String note){}
 public record AccountResponse(Long id,Long platformId,String accountName,String externalAccountCode,String currency,BigDecimal currentBalance,BigDecimal availableCapital,BigDecimal lockedCapital,BigDecimal accumulatedProfit,BigDecimal accumulatedReward,BigDecimal reservedWithdrawal,String status,long version){}
 public record DepositRequest(@NotNull Long accountId,@NotNull @Positive BigDecimal amount,@NotNull @PositiveOrZero BigDecimal fee,@NotBlank String referenceNumber,String paymentMethod,@Size(max=1000)String note){}
 public record TaskRequest(@NotNull Long accountId,@NotBlank String taskCode,@NotBlank String taskName,String taskType,@NotNull @Positive BigDecimal allocatedCapital,@PositiveOrZero BigDecimal expectedProfit,@PositiveOrZero BigDecimal expectedReward,Instant expectedCompletionDate){}
 public record SettlementRequest(@NotNull @PositiveOrZero BigDecimal totalReceived,@NotNull @PositiveOrZero BigDecimal capitalReturned,@NotNull @PositiveOrZero BigDecimal profitReceived,@NotNull @PositiveOrZero BigDecimal rewardReceived,@NotNull @PositiveOrZero BigDecimal fee,@NotBlank String referenceNumber){}
 public record WithdrawalRequest(@NotNull Long accountId,@NotNull @Positive BigDecimal requestedAmount,@NotNull @PositiveOrZero BigDecimal fee,@NotBlank String destinationAccount,@NotBlank String referenceNumber){}
 public record RewardRequest(@NotNull Long accountId,Long taskId,@NotBlank String rewardType,String rewardSource,@NotNull @Positive BigDecimal amount,String conditionDescription,String note){}
 public record OperationResponse(Long id,String status,AccountResponse account){}
 public record DashboardResponse(BigDecimal totalDeposited,BigDecimal currentBalance,BigDecimal availableCapital,BigDecimal lockedCapital,BigDecimal totalProfit,BigDecimal totalReward,BigDecimal pendingWithdrawal,BigDecimal totalWithdrawn){}
}
