package com.db.kiragateway.credit;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record CreditCardRow(
        long creditCardId,
        int userId,
        String bankName,
        String cardLabel,
        String lastFour,
        BigDecimal creditLimit,
        BigDecimal outstandingBalance,
        String cardholderName,
        int statementDay,
        int paymentDueDay,
        LocalTime reminderTime,
        boolean cycleStatementDone,
        boolean cycleDuePaid,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
