package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.CardTransactionSource;
import com.kira.bank.creditcard.domain.CardTransactionType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class CardTransactionDtos {
    private CardTransactionDtos() {
    }

    public record TransactionResponse(Long id, Long cardId, String cardNickname, String cardLastFour,
                                      Long statementId, Long importId,
                                      LocalDate transactionDate, LocalDate postingDate, String description,
                                      BigDecimal amount, String currency, CardTransactionType transactionType,
                                      String mccCode, Long cashbackRuleId, String categoryName,
                                      CardTransactionSource source, long version, Instant createdAt) {
    }

    public record ManualTransactionRequest(
        @NotNull LocalDate transactionDate,
        @NotBlank @Size(max = 500) String description,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4) BigDecimal amount,
        CardTransactionType transactionType,
        @Pattern(regexp = "\\d{4}") String mccCode,
        @Positive Long cashbackRuleId) {
    }

    public record UpdateTransactionRequest(
        @NotNull LocalDate transactionDate,
        @NotBlank @Size(max = 500) String description,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4) BigDecimal amount,
        @NotNull CardTransactionType transactionType,
        @Pattern(regexp = "\\d{4}") String mccCode,
        @Positive Long cashbackRuleId,
        @NotNull @PositiveOrZero Long version) {
    }

    public record MerchantRuleRequest(
        @NotBlank @Size(max = 100) String pattern,
        @NotNull @Pattern(regexp = "\\d{4}") String mccCode,
        @Size(max = 150) String label,
        Boolean applyToExisting,
        @PositiveOrZero Long version) {
    }

    public record MerchantRuleResponse(Long id, String pattern, String mccCode, String label, long version,
                                       Instant updatedAt) {
    }

    public record MerchantRuleSaveResponse(MerchantRuleResponse rule, int updatedTransactions) {
    }

    public record GroupProgress(Long ruleId, Long programId, String programName, String categoryName,
                                BigDecimal cashbackRate, BigDecimal spent, BigDecimal earned, BigDecimal cap,
                                BigDecimal remaining, List<String> mccCodes) {
    }

    public record CashbackProgressResponse(Long cardId, String currency, LocalDate periodStart, LocalDate periodEnd,
                                           BigDecimal cardCap, BigDecimal cardEarned, BigDecimal cardRemaining,
                                           BigDecimal unassignedSpending, List<GroupProgress> groups) {
    }

    public record CardRecommendation(Long cardId, Long bankId, String bankName, String bankLogoUrl,
                                     String nickname, String cardType, String lastFour, String currency,
                                     Long ruleId, String programName, String categoryName,
                                     BigDecimal cashbackRate, BigDecimal estimatedCashback,
                                     BigDecimal ruleCap, BigDecimal ruleRemaining,
                                     BigDecimal cardCap, BigDecimal cardRemaining,
                                     BigDecimal availableCredit, boolean insufficientCredit,
                                     LocalDate periodStart, LocalDate periodEnd, List<String> reasons) {
    }

    public record RecommendationResponse(String mccCode, BigDecimal amount, List<CardRecommendation> cards) {
    }
}
