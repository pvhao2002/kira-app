package com.db.kiragateway.credit.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateCreditCardRequest(
        @NotBlank @Size(max = 128) String bankName,
        @NotBlank @Size(max = 256) String cardLabel,
        @Pattern(regexp = "^(|\\d{4})$", message = "lastFour must be empty or 4 digits") String lastFour,
        @NotNull @DecimalMin("0") BigDecimal creditLimit,
        @NotNull @DecimalMin("0") BigDecimal outstandingBalance,
        @NotBlank @Size(max = 128) String cardholderName,
        @NotNull @Min(1) @Max(31) Integer statementDay,
        @NotNull @Min(1) @Max(31) Integer paymentDueDay,
        @NotBlank @Pattern(regexp = "\\d{2}:\\d{2}") String reminderTime
) {
}
