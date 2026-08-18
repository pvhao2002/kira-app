package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Candidate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InvestmentTransactionDeduplicationServiceTest {
    private final InvestmentAccountTransactionRepository repository = mock(InvestmentAccountTransactionRepository.class);
    private final InvestmentTransactionNormalizationService normalization =
        new InvestmentTransactionNormalizationService("Asia/Ho_Chi_Minh");
    private InvestmentTransactionDeduplicationService service;

    @BeforeEach
    void setUp() {
        service = new InvestmentTransactionDeduplicationService(repository, normalization);
    }

    @Test
    void upgradesPendingToTerminalButDoesNotDowngradeTerminal() {
        InvestmentAccountTransaction pending = transaction(9L, InvestmentTransactionStatus.PENDING,
            InvestmentTransactionType.DEPOSIT, "100", "VND");
        when(repository.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(1L, "TX1"))
            .thenReturn(Optional.of(pending));
        assertThat(service.decide(candidate(InvestmentTransactionStatus.COMPLETED, "TX1"), false).action())
            .isEqualTo(InvestmentProcessingAction.UPDATE);

        pending.setTransactionStatus(InvestmentTransactionStatus.COMPLETED);
        assertThat(service.decide(candidate(InvestmentTransactionStatus.PENDING, "TX1"), false).action())
            .isEqualTo(InvestmentProcessingAction.DUPLICATE);
    }

    @Test
    void financialConflictRequiresReview() {
        InvestmentAccountTransaction existing = transaction(9L, InvestmentTransactionStatus.COMPLETED,
            InvestmentTransactionType.WITHDRAWAL, "200", "USD");
        when(repository.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(1L, "TX1"))
            .thenReturn(Optional.of(existing));
        var decision = service.decide(candidate(InvestmentTransactionStatus.COMPLETED, "TX1"), false);
        assertThat(decision.action()).isEqualTo(InvestmentProcessingAction.REVIEW);
        assertThat(decision.warnings()).contains("TYPE_CONFLICT", "AMOUNT_CONFLICT", "CURRENCY_CONFLICT");
    }

    @Test
    void fallbackCollisionAlwaysRequiresReview() {
        when(repository.findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(eq(1L), any(byte[].class)))
            .thenReturn(Optional.of(transaction(3L, InvestmentTransactionStatus.COMPLETED,
                InvestmentTransactionType.DEPOSIT, "100", "VND")));
        var withoutExternal = new Candidate("item-1", 1L, "VND", InvestmentTransactionType.DEPOSIT,
            InvestmentTransactionStatus.COMPLETED, new BigDecimal("100"), "VND",
            Instant.parse("2026-08-18T02:30:45Z"), null, new BigDecimal("0.95"), List.of());
        assertThat(service.decide(withoutExternal, false).action()).isEqualTo(InvestmentProcessingAction.REVIEW);
    }

    private Candidate candidate(InvestmentTransactionStatus status, String externalId) {
        return new Candidate("item-1", 1L, "VND", InvestmentTransactionType.DEPOSIT, status,
            new BigDecimal("100"), "VND", Instant.parse("2026-08-18T02:30:45Z"), externalId,
            new BigDecimal("0.95"), List.of());
    }

    private InvestmentAccountTransaction transaction(Long id, InvestmentTransactionStatus status,
                                                     InvestmentTransactionType type, String amount, String currency) {
        InvestmentAccountTransaction value = new InvestmentAccountTransaction();
        value.setId(id);
        value.setTransactionStatus(status);
        value.setTransactionType(type);
        value.setAmount(new BigDecimal(amount));
        value.setCurrency(currency);
        return value;
    }
}
