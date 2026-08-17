package com.kira.bank.creditcard.application;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class CreditCardDtos {
    private CreditCardDtos() {
    }

    public record CreateCardRequest(@NotNull Long bankId, @NotBlank String nickname,
                                    @Pattern(regexp = "\\d{4}") String lastFour,
                                    @NotNull @Positive BigDecimal creditLimit, @Min(1) @Max(31) int statementDay,
                                    @Min(1) @Max(31) int dueDay, String note) {
    }

    public record UpdateCardRequest(@NotBlank String nickname, @Pattern(regexp = "\\d{4}") String lastFour,
                                    @NotNull @Positive BigDecimal creditLimit, @Min(1) @Max(31) int statementDay,
                                    @Min(1) @Max(31) int dueDay, String note,
                                    @NotBlank String status, @NotNull @PositiveOrZero Long version,
                                    @NotNull @PositiveOrZero Long creditLimitVersion) {
    }

    public record CardResponse(Long id, Long bankId, String bankName, String bankLogoUrl, String nickname,
                               String lastFour, BigDecimal creditLimit, long creditLimitVersion,
                               BigDecimal currentBalance,
                               String currency, int statementDay,
                               int dueDay, String status, String note, long version,
                               Long billingCycleId, LocalDate statementDate, LocalDate paymentDueDate,
                               BigDecimal statementBalance, BigDecimal minimumPayment,
                               String billingStatus, long billingVersion) {
    }

    public record BankCreditLimitUpdateRequest(@NotNull @Positive BigDecimal creditLimit,
                                               @NotNull @PositiveOrZero Long version) {
    }

    public record BankCreditLimitResponse(Long bankId, String bankName, String bankLogoUrl,
                                          BigDecimal creditLimit, String currency, long version) {
    }

    public record BillingCycleUpdateRequest(@Positive Long billingCycleId,
                                            @NotNull @Positive BigDecimal statementBalance,
                                            @NotNull @Positive BigDecimal minimumPayment,
                                            @NotBlank String paymentStatus,
                                            @NotNull @PositiveOrZero Long version) {
    }

    public record BillingCycleResponse(Long billingCycleId, LocalDate statementDate, LocalDate paymentDueDate,
                                       BigDecimal statementBalance, BigDecimal minimumPayment,
                                       String billingStatus, long billingVersion) {
    }

    public record TransactionRequest(@NotNull Long userCardId, @NotNull Instant transactionDate, @NotNull Long mccId,
                                     @NotNull @Positive BigDecimal amount, String currency,
                                     @NotBlank String referenceNumber, String description, String note) {
    }

    public record StatementRequest(@NotNull Long userCardId, @NotNull LocalDate periodStart,
                                   @NotNull LocalDate periodEnd, @NotNull LocalDate statementDate,
                                   @NotNull LocalDate dueDate, @NotNull @PositiveOrZero BigDecimal openingBalance,
                                   @NotNull @PositiveOrZero BigDecimal totalSpending,
                                   @NotNull @PositiveOrZero BigDecimal totalRefund,
                                   @NotNull @PositiveOrZero BigDecimal totalFee,
                                   @NotNull @PositiveOrZero BigDecimal totalInterest,
                                   @NotNull @PositiveOrZero BigDecimal minimumPayment) {
    }

    public record PaymentRequest(@NotNull @Positive BigDecimal amount, @NotBlank String paymentMethod,
                                 String sourceAccount, @NotBlank String referenceNumber, String note) {
    }

    public record InvoiceRequest(@NotNull Long userCardId, @NotNull Long serviceProviderId,
                                 @NotBlank String invoiceNumber, @NotNull LocalDate invoiceDate,
                                 @NotNull @Positive BigDecimal invoiceAmount, @NotNull @Positive BigDecimal amountPaid,
                                 @NotNull @DecimalMin("0") BigDecimal serviceDiscountRate,
                                 @NotNull @DecimalMin("0") BigDecimal additionalFee,
                                 @NotNull @DecimalMin("0") BigDecimal cashbackRate,
                                 @DecimalMin("0") BigDecimal actualCashback, String note) {
    }

    public record StatementResponse(Long id, BigDecimal statementBalance, BigDecimal paidAmount,
                                    BigDecimal remainingAmount, String status, long version) {
    }

    public record PaymentResponse(Long id, String status, StatementResponse statement) {
    }

    public record InvoiceResponse(Long id, BigDecimal serviceCost, BigDecimal expectedCashback,
                                  BigDecimal actualCashback, BigDecimal expectedProfit, BigDecimal actualProfit,
                                  String status) {
    }
}
