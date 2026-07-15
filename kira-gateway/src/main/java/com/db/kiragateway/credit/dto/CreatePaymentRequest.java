package com.db.kiragateway.credit.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreatePaymentRequest(
        @NotNull LocalDate paidAt,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        String note,
        Long statementCycleId
) {
}
