package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class InvestmentTransactionImportDtos {
    private InvestmentTransactionImportDtos() {
    }

    public record BatchSummary(int detected, int inserted, int updated, int skipped, int failed, int review) {
    }

    public record ImportFileResponse(Long attachmentId, String originalName, String contentUrl,
                                     InvestmentImportFileStatus status, String errorCode) {
    }

    public record ImportItemResponse(
        String itemId, long version, InvestmentTransactionType transactionType,
        InvestmentTransactionStatus transactionStatus, BigDecimal amount, String currency,
        Instant transactionAt, String externalTransactionId, String description, String rawText,
        BigDecimal confidence, InvestmentProcessingAction processingAction,
        Long matchedTransactionId, List<String> warnings
    ) {
    }

    public record ImportBatchResponse(
        String batchId, Long accountId, InvestmentImportBatchStatus status,
        BatchSummary summary, List<ImportFileResponse> files, List<ImportItemResponse> transactions
    ) {
    }

    public record ConfirmItemRequest(
        @NotBlank String itemId,
        @NotNull @PositiveOrZero Long version,
        boolean selected,
        InvestmentImportResolution resolution,
        InvestmentTransactionType transactionType,
        InvestmentTransactionStatus transactionStatus,
        @Positive BigDecimal amount,
        @Pattern(regexp = "[A-Z]{3}") String currency,
        Instant transactionAt,
        @Size(max = 150) String externalTransactionId,
        @Size(max = 1000) String description
    ) {
    }

    public record ConfirmBatchRequest(@NotEmpty List<@Valid ConfirmItemRequest> transactions) {
    }

    public record ConfirmItemResult(String itemId, String result, Long transactionId, String errorCode) {
    }

    public record ConfirmBatchResponse(int inserted, int updated, int skipped, int failed,
                                       List<ConfirmItemResult> results) {
    }

    public record TransactionResponse(
        Long id, InvestmentTransactionType transactionType, InvestmentTransactionStatus transactionStatus,
        BigDecimal amount, String currency, Instant transactionAt, String externalTransactionId,
        String description, String rawText, BigDecimal confidence, String sourceFileHash, long version
    ) {
    }
}
