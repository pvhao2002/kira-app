package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Candidate;
import com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Decision;
import com.kira.bank.investment.domain.InvestmentAccountTransaction;
import com.kira.bank.investment.domain.InvestmentProcessingAction;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Decisions that drive auto-commit: only INSERT/UPDATE/DUPLICATE are recorded without a human. */
class InvestmentTransactionDeduplicationServiceTest {
    private static final Instant AT = Instant.parse("2026-03-01T03:00:00Z");

    private final InvestmentAccountTransactionRepository repository = mock(InvestmentAccountTransactionRepository.class);
    private final InvestmentTransactionDeduplicationService service = new InvestmentTransactionDeduplicationService(
        repository, new InvestmentTransactionNormalizationService("Asia/Ho_Chi_Minh"));

    private static Candidate candidate(String externalId, String confidence) {
        return new Candidate("item-1", 1L, "VND", InvestmentTransactionType.DEPOSIT,
            InvestmentTransactionStatus.COMPLETED, new BigDecimal("500000.0000"), "VND", AT, externalId,
            new BigDecimal(confidence), List.of());
    }

    private static InvestmentAccountTransaction existing() {
        InvestmentAccountTransaction existing = new InvestmentAccountTransaction();
        existing.setId(9L);
        existing.setTransactionType(InvestmentTransactionType.DEPOSIT);
        existing.setTransactionStatus(InvestmentTransactionStatus.COMPLETED);
        existing.setAmount(new BigDecimal("500000.0000"));
        existing.setCurrency("VND");
        return existing;
    }

    @Test
    void confidentNewRowIsInserted() {
        Decision decision = service.decide(candidate("TX1", "0.95"), false);

        assertEquals(InvestmentProcessingAction.INSERT, decision.action());
    }

    @Test
    void lowConfidenceNeedsReview() {
        Decision decision = service.decide(candidate("TX1", "0.50"), false);

        assertEquals(InvestmentProcessingAction.REVIEW, decision.action());
        assertTrue(decision.warnings().contains("LOW_CONFIDENCE"));
    }

    @Test
    void sameExternalIdWithEqualFieldsIsDuplicate() {
        when(repository.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(1L, "TX1"))
            .thenReturn(Optional.of(existing()));

        Decision decision = service.decide(candidate("TX1", "0.95"), false);

        assertEquals(InvestmentProcessingAction.DUPLICATE, decision.action());
        assertEquals(9L, decision.matchedTransactionId());
    }

    @Test
    void fallbackKeyCollisionWithoutExternalIdNeedsReview() {
        when(repository.findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(eq(1L), any()))
            .thenReturn(Optional.of(existing()));

        Decision decision = service.decide(candidate(null, "0.95"), false);

        assertEquals(InvestmentProcessingAction.REVIEW, decision.action());
        assertTrue(decision.warnings().contains("FALLBACK_DEDUP_COLLISION"));
    }
}
