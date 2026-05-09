package com.db.kiragateway.transaction.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreateManualTransactionRequest(
        @NotBlank String type,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotBlank String transactionAt,
        String description
) {
}
