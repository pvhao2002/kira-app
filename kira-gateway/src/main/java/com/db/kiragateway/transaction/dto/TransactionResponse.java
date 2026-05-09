package com.db.kiragateway.transaction.dto;

import java.math.BigDecimal;

public record TransactionResponse(
        long transactionId,
        String type,
        BigDecimal amount,
        String transactionAt,
        String description,
        String source,
        String status,
        boolean pendingAiExtraction,
        String aiError
) {
}
