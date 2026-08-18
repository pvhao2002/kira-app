package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentTransactionType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class InvestmentTransactionNormalizationServiceTest {
    private final InvestmentTransactionNormalizationService service =
        new InvestmentTransactionNormalizationService("Asia/Ho_Chi_Minh");

    @Test
    void normalizesVietnameseMoneyAndAbsoluteAmount() {
        assertThat(service.amount("-1.234.567 VNĐ")).isEqualByComparingTo("1234567.0000");
        assertThat(service.amount("1,25 VND")).isEqualByComparingTo("1.2500");
        assertThat(service.amount(new BigDecimal("-42.12345"))).isEqualByComparingTo("42.1235");
        assertThat(service.currency("đ")).isEqualTo("VND");
        assertThat(service.currency("₫")).isEqualTo("VND");
        assertThat(service.currency("VNĐ")).isEqualTo("VND");
    }

    @Test
    void normalizesExternalIdTimezoneAndDescription() {
        assertThat(service.externalId(" No.  AB 12  ")).isEqualTo("AB12");
        assertThat(service.externalId("Nº  9988")).isEqualTo("9988");
        assertThat(service.externalId("# TX 01")).isEqualTo("TX01");
        assertThat(service.instant("2026-08-18T09:30:00"))
            .isEqualTo(Instant.parse("2026-08-18T02:30:00Z"));
        assertThat(service.description("Nº TX99 +1.250.000đ  Tiền thưởng!"))
            .isEqualTo("tiền thưởng");
    }

    @Test
    void saveAsNewFingerprintIsStableAndDistinct() {
        Instant time = Instant.parse("2026-08-18T02:30:45Z");
        byte[] normal = service.dedupKey(7L, InvestmentTransactionType.DEPOSIT, null,
            new BigDecimal("100.0000"), "VND", time, null);
        byte[] first = service.dedupKey(7L, InvestmentTransactionType.DEPOSIT, null,
            new BigDecimal("100.0000"), "VND", time, "item-1");
        byte[] repeated = service.dedupKey(7L, InvestmentTransactionType.DEPOSIT, null,
            new BigDecimal("100.0000"), "VND", time, "item-1");
        assertThat(first).isEqualTo(repeated).isNotEqualTo(normal);
    }
}
