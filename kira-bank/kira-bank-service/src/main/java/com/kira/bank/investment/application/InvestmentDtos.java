package com.kira.bank.investment.application;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public final class InvestmentDtos {
    private InvestmentDtos() {
    }

    public record CreateAccountRequest(
        @NotBlank @Size(max = 100) String accountCode,
        @NotBlank @Size(max = 150) String accountName,
        @NotBlank @Size(max = 100) String accountUsername,
        @NotBlank @Size(max = 150) String accountEmail,
        @NotBlank @Size(max = 50) String phoneNumber,
        @NotNull LocalDate registerDate,
        @NotBlank @Size(max = 100) String accountPassword,
        @Pattern(regexp = "[A-Z]{3}") String currency
    ) {
    }

    public record UpdateAccountRequest(
        @Size(max = 100) String accountCode,
        @NotBlank @Size(max = 150) String accountName,
        @Size(max = 100) String accountUsername,
        @Size(max = 150) String accountEmail,
        @Size(max = 50) String phoneNumber,
        LocalDate registerDate,
        @Size(max = 100) String accountPassword,
        @Size(max = 1000) String note,
        @NotBlank String status,
        @NotNull @PositiveOrZero Long version
    ) {
    }

    public record AccountResponse(
        Long id, String accountCode, String accountName, String accountUsername, String accountEmail,
        String phoneNumber, LocalDate registerDate, String accountPassword,
        String currency, String status, String note, long version
    ) {
    }
}
