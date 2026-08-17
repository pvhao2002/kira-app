package com.kira.bank.investment.application;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public final class InvestmentDtos {
    private InvestmentDtos() {
    }

    public record CreateAccountRequest(
        Long platformId,
        @NotBlank @Size(max = 100) String accountCode,
        @NotBlank @Size(max = 150) String accountName,
        @NotBlank @Size(max = 100) String accountUsername,
        @NotBlank @Size(max = 150) String accountEmail,
        @NotBlank @Size(max = 50) String phoneNumber,
        @NotNull Instant registerDate,
        @NotBlank @Size(max = 100) String accountPassword,
        @Pattern(regexp = "[A-Z]{3}") String currency
    ) {
    }

    public record UpdateAccountRequest(
        @Size(max = 100) String accountCode,
        @NotBlank @Size(max = 150) String accountName,
        @Size(max = 100) String externalAccountCode,
        @Size(max = 100) String accountUsername,
        @Size(max = 150) String accountEmail,
        @Size(max = 50) String phoneNumber,
        Instant registerDate,
        @Size(max = 100) String accountPassword,
        @Size(max = 1000) String note,
        @NotBlank String status,
        @NotNull @PositiveOrZero Long version
    ) {
    }

    public record AccountResponse(
        Long id, Long platformId, String accountCode, String accountName, String externalAccountCode,
        String accountUsername, String accountEmail, String phoneNumber, Instant registerDate, String accountPassword,
        String currency, BigDecimal currentBalance, BigDecimal availableCapital,
        BigDecimal lockedCapital, BigDecimal accumulatedProfit, BigDecimal accumulatedReward,
        BigDecimal reservedWithdrawal, String status, String note, long version
    ) {
    }

    public record DepositRequest(@NotNull Long accountId, @NotNull @Positive BigDecimal amount,
                                 @NotNull @PositiveOrZero BigDecimal fee, @NotBlank String referenceNumber,
                                 String paymentMethod, @Size(max = 1000) String note,
                                 Long attachmentId, Instant transactionDate) {
    }

    public record TaskRequest(@NotNull Long accountId, @NotBlank String taskCode, @NotBlank String taskName,
                              String taskType, @NotNull @Positive BigDecimal allocatedCapital,
                              @PositiveOrZero BigDecimal expectedProfit, @PositiveOrZero BigDecimal expectedReward,
                              Instant expectedCompletionDate) {
    }

    public record SettlementRequest(@NotNull @PositiveOrZero BigDecimal totalReceived,
                                    @NotNull @PositiveOrZero BigDecimal capitalReturned,
                                    @NotNull @PositiveOrZero BigDecimal profitReceived,
                                    @NotNull @PositiveOrZero BigDecimal rewardReceived,
                                    @NotNull @PositiveOrZero BigDecimal fee, @NotBlank String referenceNumber) {
    }

    public record WithdrawalRequest(@NotNull Long accountId, @NotNull @Positive BigDecimal requestedAmount,
                                    @NotNull @PositiveOrZero BigDecimal fee, @NotBlank String destinationAccount,
                                    @NotBlank String referenceNumber, Long attachmentId, Instant transactionDate) {
    }

    public record RewardRequest(@NotNull Long accountId, Long taskId, @NotBlank String rewardType, String rewardSource,
                                @NotNull @Positive BigDecimal amount, String conditionDescription, String note,
                                Long attachmentId, Instant transactionDate) {
    }

    public record CreateTransactionRequest(
        @NotNull Long accountId,
        @NotBlank String type, // DEPOSIT, WITHDRAWAL, BONUS
        @NotNull @Positive BigDecimal amount,
        Instant transactionDate,
        @Size(max = 1000) String description,
        Long attachmentId
    ) {
    }

    public record OperationResponse(Long id, String status, AccountResponse account) {
    }

    public record DashboardResponse(BigDecimal totalDeposited, BigDecimal currentBalance, BigDecimal availableCapital,
                                    BigDecimal lockedCapital, BigDecimal totalProfit, BigDecimal totalReward,
                                    BigDecimal pendingWithdrawal, BigDecimal totalWithdrawn) {
    }
}
