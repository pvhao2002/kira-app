package com.db.kiragateway.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreditCardResponse(
        long creditCardId,
        String bankName,
        String cardLabel,
        String lastFour,
        BigDecimal creditLimit,
        BigDecimal outstandingBalance,
        String cardholderName,
        int statementDay,
        int paymentDueDay,
        String reminderTime,
        boolean cycleStatementDone,
        boolean cycleDuePaid,
        String nextStatementLabel,
        String nextDueLabel,
        Long daysUntilDue,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
