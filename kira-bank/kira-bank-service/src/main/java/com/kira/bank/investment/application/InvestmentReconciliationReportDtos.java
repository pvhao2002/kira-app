package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentReconciliationReportReason;
import com.kira.bank.investment.domain.InvestmentReconciliationReportStatus;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class InvestmentReconciliationReportDtos {
    private InvestmentReconciliationReportDtos() {
    }

    public record CreateReportRequest(
        @NotNull InvestmentReconciliationReportReason reason,
        @NotBlank @Size(min = 10, max = 1000) String detail
    ) {
    }

    public record UpdateReportStatusRequest(
        @NotNull InvestmentReconciliationReportStatus status,
        @Size(max = 2000) String resolutionNote,
        @NotNull @PositiveOrZero Long version
    ) {
    }

    public record ReportEventResponse(
        InvestmentReconciliationReportStatus fromStatus,
        InvestmentReconciliationReportStatus toStatus,
        String note,
        Instant createdAt
    ) {
    }

    public record ReportResponse(
        Long id,
        Long accountId,
        String accountName,
        Long transactionId,
        InvestmentTransactionType transactionType,
        InvestmentTransactionStatus transactionStatus,
        BigDecimal amount,
        String currency,
        Instant transactionAt,
        String externalTransactionId,
        Long sourceAttachmentId,
        InvestmentReconciliationReportReason reason,
        String detail,
        InvestmentReconciliationReportStatus status,
        String resolutionNote,
        Instant createdAt,
        Instant resolvedAt,
        long version,
        List<ReportEventResponse> history
    ) {
    }
}
