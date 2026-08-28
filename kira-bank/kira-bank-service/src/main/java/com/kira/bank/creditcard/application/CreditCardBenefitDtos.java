package com.kira.bank.creditcard.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public final class CreditCardBenefitDtos {
    private CreditCardBenefitDtos() {
    }

    public record MonthlyCapRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4)
        BigDecimal monthlyCashbackCap,
        @PositiveOrZero Long version) {
    }

    public record CashbackRuleRequest(
        @Positive Long id,
        @PositiveOrZero Long version,
        @NotBlank @Size(max = 150) String categoryName,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100") @Digits(integer = 3, fraction = 4)
        BigDecimal cashbackRate,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4)
        BigDecimal maxCashbackAmount,
        @NotEmpty List<@NotBlank @Pattern(regexp = "\\d{4}") String> mccCodes) {
    }

    public record CashbackProgramRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 2000) String notes,
        @Size(max = 500) String termsUrl,
        @NotNull Boolean active,
        @PositiveOrZero Long version,
        @NotEmpty List<@Valid CashbackRuleRequest> groups) {
    }

    public record VersionRequest(@NotNull @PositiveOrZero Long version) {
    }

    public record CashbackRuleResponse(Long id, String categoryName, BigDecimal cashbackRate,
                                       BigDecimal maxCashbackAmount, List<String> mccCodes, long version) {
    }

    public record CashbackProgramResponse(Long id, String name, String notes, String termsUrl,
                                          boolean active, long version, List<CashbackRuleResponse> groups) {
    }

    public record CardBenefitResponse(Long cardId, Long bankId, String bankName, String bankLogoUrl,
                                      String cardType, String nickname, String lastFour, String status,
                                      String currency, BigDecimal monthlyCashbackCap, Long configVersion,
                                      List<CashbackProgramResponse> programs) {
    }
}
