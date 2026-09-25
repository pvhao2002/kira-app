package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.CardStatementImportStatus;
import com.kira.bank.creditcard.domain.CardTransactionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class CardStatementImportDtos {
    private CardStatementImportDtos() {
    }

    /** AI draft after server-side normalization. Stored as JSON on the import and shown for review. */
    public record StatementDraft(LocalDate statementDate, LocalDate dueDate, LocalDate periodStart,
                                 LocalDate periodEnd, BigDecimal openingBalance, BigDecimal totalSpending,
                                 BigDecimal totalRefund, BigDecimal totalFee, BigDecimal totalInterest,
                                 BigDecimal statementBalance, BigDecimal minimumPayment, String currency,
                                 String cardLastFour, BigDecimal confidence, List<String> warnings,
                                 List<String> aiWarnings, int ignoredPaymentRows,
                                 List<TransactionDraft> transactions) {
    }

    public record TransactionDraft(int lineNumber, LocalDate transactionDate, LocalDate postingDate,
                                   String description, BigDecimal amount, CardTransactionType transactionType,
                                   String mccCode, Long cashbackRuleId, String suggestedCategory,
                                   BigDecimal confidence, boolean duplicate, boolean needsReview,
                                   List<String> warnings) {
    }

    public record ImportFileResponse(Long attachmentId, int pageNumber, String originalName) {
    }

    public record ConfirmResponse(Long statementId, boolean totalsApplied, int inserted, int skipped,
                                  int supersededManual, BigDecimal expectedCashback) {
    }

    public record StatementImportResponse(Long id, Long cardId, CardStatementImportStatus status, int attemptCount,
                                          String errorCode, long version, Instant createdAt, Instant completedAt,
                                          boolean aiConfigured, boolean storagePurged,
                                          List<ImportFileResponse> files, StatementDraft draft,
                                          Long statementId, ConfirmResponse result) {
    }

    public record VersionRequest(@NotNull @PositiveOrZero Long version) {
    }

    public record ConfirmTransactionRequest(
        @NotNull Boolean include,
        @NotNull LocalDate transactionDate,
        LocalDate postingDate,
        @NotBlank @Size(max = 500) String description,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4) BigDecimal amount,
        @NotNull CardTransactionType transactionType,
        @Pattern(regexp = "\\d{4}") String mccCode,
        @Positive Long cashbackRuleId) {
    }

    public record ConfirmRequest(
        @NotNull @PositiveOrZero Long version,
        @NotNull LocalDate statementDate,
        @NotNull LocalDate dueDate,
        LocalDate periodStart,
        LocalDate periodEnd,
        @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal openingBalance,
        @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal totalSpending,
        @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal totalRefund,
        @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal totalFee,
        @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal totalInterest,
        @NotNull @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal statementBalance,
        @NotNull @PositiveOrZero @Digits(integer = 15, fraction = 4) BigDecimal minimumPayment,
        @NotNull @Size(max = 500) List<@Valid @NotNull ConfirmTransactionRequest> transactions) {
    }
}
