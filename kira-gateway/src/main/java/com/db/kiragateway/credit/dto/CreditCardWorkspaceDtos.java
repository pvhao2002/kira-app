package com.db.kiragateway.credit.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

public final class CreditCardWorkspaceDtos {

    private CreditCardWorkspaceDtos() {
    }

    public record OverviewResponse(
            OverviewSummary summary,
            List<CreditCardResponse> cards,
            List<StatementCycleResponse> latestStatements,
            List<StatementCycleResponse> dueStatements,
            List<CashbackTransactionResponse> recentTransactions,
            List<MccCategoryResponse> mccCoverage
    ) {
    }

    public record OverviewSummary(
            BigDecimal totalOutstandingBalance,
            BigDecimal pendingCashbackAmount,
            BigDecimal investedCostAmount,
            BigDecimal realizedNetProfit,
            long activeCardCount,
            long pendingCashbackCount
    ) {
    }

    public record CreateCashbackTransactionRequest(
            @NotNull Long creditCardId,
            Long mccCategoryId,
            @NotNull LocalDate transactionDate,
            @Size(max = 160) String customerName,
            @Size(max = 160) String billReference,
            @Size(max = 512) String description,
            @NotNull @DecimalMin("0.01") BigDecimal spendAmount,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal discountRate,
            @DecimalMin("0") @DecimalMax("100") BigDecimal manualCashbackRate,
            LocalDate cashbackDueDate,
            String note
    ) {
    }

    public record UpdateCashbackTransactionRequest(
            Long creditCardId,
            Long mccCategoryId,
            LocalDate transactionDate,
            @Size(max = 160) String customerName,
            @Size(max = 160) String billReference,
            @Size(max = 512) String description,
            @DecimalMin("0.01") BigDecimal spendAmount,
            @DecimalMin("0") @DecimalMax("100") BigDecimal discountRate,
            @DecimalMin("0") @DecimalMax("100") BigDecimal manualCashbackRate,
            LocalDate cashbackDueDate,
            String note
    ) {
    }

    public record ReceiveCashbackRequest(
            @NotNull @DecimalMin("0") BigDecimal actualCashbackAmount,
            @NotNull LocalDate receivedAt
    ) {
    }

    public record CashbackTransactionResponse(
            long transactionId,
            long creditCardId,
            String cardLabel,
            String bankName,
            String lastFour,
            Long mccCategoryId,
            String mccCode,
            String mccCategoryName,
            LocalDate transactionDate,
            String customerName,
            String billReference,
            String description,
            BigDecimal spendAmount,
            BigDecimal discountRate,
            BigDecimal discountAmount,
            BigDecimal cashbackRate,
            BigDecimal monthlyCapAmount,
            BigDecimal expectedCashbackAmount,
            BigDecimal actualCashbackAmount,
            BigDecimal projectedNetProfit,
            BigDecimal realizedNetProfit,
            LocalDate cashbackDueDate,
            LocalDate cashbackReceivedAt,
            String status,
            String note,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record CashbackTransactionPageResponse(
            List<CashbackTransactionResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
    }

    public record CreateStatementCycleRequest(
            @NotNull YearMonth cycleMonth,
            LocalDate statementDate,
            LocalDate dueDate,
            @DecimalMin("0") BigDecimal statementAmount,
            LocalDateTime statementIssuedAt,
            String note
    ) {
    }

    public record UpdateStatementCycleRequest(
            LocalDate statementDate,
            LocalDate dueDate,
            @DecimalMin("0") BigDecimal statementAmount,
            LocalDateTime statementIssuedAt,
            String note
    ) {
    }

    public record StatementCycleResponse(
            long statementCycleId,
            long creditCardId,
            String cardLabel,
            String bankName,
            String lastFour,
            LocalDate cycleMonth,
            LocalDate statementDate,
            LocalDate dueDate,
            BigDecimal statementAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            LocalDateTime statementIssuedAt,
            String status,
            long daysUntilDue,
            String note,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record StatementCyclePageResponse(
            List<StatementCycleResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
    }

    public record CreateMccCategoryRequest(
            @NotBlank @Pattern(regexp = "\\d{4}") String mccCode,
            @NotBlank @Size(max = 160) String categoryName,
            String description,
            List<@Valid CashbackRuleInput> rules
    ) {
    }

    public record UpdateMccCategoryRequest(
            @Pattern(regexp = "\\d{4}") String mccCode,
            @Size(max = 160) String categoryName,
            String description,
            Boolean active
    ) {
    }

    public record CashbackRuleInput(
            @NotNull Long creditCardId,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal cashbackRate,
            @DecimalMin("0") BigDecimal monthlyCapAmount,
            @NotNull LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String note
    ) {
    }

    public record UpdateCashbackRuleRequest(
            @DecimalMin("0") @DecimalMax("100") BigDecimal cashbackRate,
            @DecimalMin("0") BigDecimal monthlyCapAmount,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean active,
            String note
    ) {
    }

    public record MccCategoryResponse(
            long mccCategoryId,
            String mccCode,
            String categoryName,
            String description,
            boolean active,
            long activeRuleCount,
            BigDecimal bestCashbackRate,
            List<CashbackRuleResponse> rules,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record CashbackRuleResponse(
            long cashbackRuleId,
            long creditCardId,
            String cardLabel,
            String bankName,
            String lastFour,
            long mccCategoryId,
            String mccCode,
            String categoryName,
            BigDecimal cashbackRate,
            BigDecimal monthlyCapAmount,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            boolean active,
            String note,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }
}
