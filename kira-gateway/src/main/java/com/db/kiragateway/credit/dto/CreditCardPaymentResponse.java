package com.db.kiragateway.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CreditCardPaymentResponse(
        long paymentId,
        LocalDate paidAt,
        BigDecimal amount,
        String note,
        LocalDateTime createdAt,
        Long statementCycleId
) {
}
