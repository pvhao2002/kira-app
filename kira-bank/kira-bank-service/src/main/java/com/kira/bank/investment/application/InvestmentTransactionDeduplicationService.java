package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentAccountTransaction;
import com.kira.bank.investment.domain.InvestmentProcessingAction;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InvestmentTransactionDeduplicationService {
    private static final BigDecimal REVIEW_CONFIDENCE = new BigDecimal("0.80");
    private final InvestmentAccountTransactionRepository transactions;
    private final InvestmentTransactionNormalizationService normalization;

    @Transactional(readOnly = true)
    public Decision decide(Candidate candidate, boolean saveAsNew) {
        List<String> warnings = new ArrayList<>(candidate.warnings());
        if (candidate.type() == null) warnings.add("MISSING_TRANSACTION_TYPE");
        if (candidate.status() == null) warnings.add("MISSING_TRANSACTION_STATUS");
        if (candidate.amount() == null || candidate.amount().signum() <= 0) warnings.add("MISSING_OR_INVALID_AMOUNT");
        if (candidate.currency() == null) warnings.add("MISSING_OR_INVALID_CURRENCY");
        if (candidate.transactionAt() == null) warnings.add("MISSING_OR_INVALID_TRANSACTION_TIME");
        if (candidate.currency() != null && !candidate.currency().equals(candidate.accountCurrency())) {
            warnings.add("CURRENCY_MISMATCH");
        }
        if (candidate.confidence() == null || candidate.confidence().compareTo(REVIEW_CONFIDENCE) < 0) {
            warnings.add("LOW_CONFIDENCE");
        }
        if (candidate.type() == null || candidate.status() == null || candidate.amount() == null
            || candidate.currency() == null || candidate.transactionAt() == null) {
            return new Decision(InvestmentProcessingAction.REVIEW, null, null, List.copyOf(warnings));
        }

        byte[] key = normalization.dedupKey(candidate.accountId(), candidate.type(), candidate.externalId(),
            candidate.amount(), candidate.currency(), candidate.transactionAt(), saveAsNew ? candidate.itemId() : null);
        var existing = candidate.externalId() == null
            ? transactions.findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(candidate.accountId(), key)
            : transactions.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(
            candidate.accountId(), candidate.externalId());

        if (existing.isPresent()) {
            InvestmentAccountTransaction current = existing.get();
            if (current.getTransactionType() != candidate.type()) warnings.add("TYPE_CONFLICT");
            if (current.getAmount().compareTo(candidate.amount()) != 0) warnings.add("AMOUNT_CONFLICT");
            if (!current.getCurrency().equals(candidate.currency())) warnings.add("CURRENCY_CONFLICT");
            if (current.getTransactionStatus().terminal() && candidate.status().terminal()
                && current.getTransactionStatus() != candidate.status()) warnings.add("STATUS_CONFLICT");
            if (warnings.stream().anyMatch(w -> w.endsWith("_CONFLICT"))) {
                return new Decision(InvestmentProcessingAction.REVIEW, current.getId(), key, List.copyOf(warnings));
            }
            if (candidate.externalId() == null && !saveAsNew) {
                warnings.add("FALLBACK_DEDUP_COLLISION");
                return new Decision(InvestmentProcessingAction.REVIEW, current.getId(), key, List.copyOf(warnings));
            }
            InvestmentProcessingAction action = current.getTransactionStatus() == InvestmentTransactionStatus.PENDING
                && candidate.status().terminal() ? InvestmentProcessingAction.UPDATE : InvestmentProcessingAction.DUPLICATE;
            if (hasReviewWarning(warnings, true)) action = InvestmentProcessingAction.REVIEW;
            return new Decision(action, current.getId(), key, List.copyOf(warnings));
        }

        InvestmentProcessingAction action = hasReviewWarning(warnings, false)
            ? InvestmentProcessingAction.REVIEW : InvestmentProcessingAction.INSERT;
        return new Decision(action, null, key, List.copyOf(warnings));
    }

    private boolean hasReviewWarning(List<String> warnings, boolean matchedExisting) {
        List<String> blocking = new ArrayList<>(List.of(
            "CURRENCY_MISMATCH", "CURRENCY_INFERRED_FROM_ACCOUNT",
            "MISSING_TRANSACTION_TYPE", "MISSING_TRANSACTION_STATUS",
            "MISSING_OR_INVALID_AMOUNT", "MISSING_OR_INVALID_CURRENCY", "MISSING_OR_INVALID_TRANSACTION_TIME"
        ));
        // Low AI confidence about field values doesn't need a human check once the transaction is
        // already confidently identified as the same one on record (matched by external id for
        // deposit/withdrawal, or by day for a bonus) with no conflicting fields.
        if (!matchedExisting) blocking.add("LOW_CONFIDENCE");
        return warnings.stream().anyMatch(blocking::contains);
    }

    public record Candidate(
        String itemId, Long accountId, String accountCurrency, InvestmentTransactionType type,
        InvestmentTransactionStatus status, BigDecimal amount, String currency, Instant transactionAt,
        String externalId, BigDecimal confidence, List<String> warnings
    ) {
    }

    public record Decision(InvestmentProcessingAction action, Long matchedTransactionId,
                           byte[] deduplicationKey, List<String> warnings) {
    }
}
