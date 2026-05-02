package com.db.kiragateway.credit.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateCreditCardRequest(
        @Size(max = 128) String bankName,
        @Size(max = 256) String cardLabel,
        @Pattern(regexp = "^(|\\d{4})$", message = "lastFour must be empty or 4 digits") String lastFour,
        @DecimalMin("0") BigDecimal creditLimit,
        @DecimalMin("0") BigDecimal outstandingBalance,
        @Size(max = 128) String cardholderName,
        @Min(1) @Max(31) Integer statementDay,
        @Min(1) @Max(31) Integer paymentDueDay,
        @Pattern(regexp = "\\d{2}:\\d{2}") String reminderTime,
        Boolean cycleStatementDone,
        Boolean cycleDuePaid
) {
}
