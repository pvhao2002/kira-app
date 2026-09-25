package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.CardTransactionType;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Deterministic deduplication keys for card transactions. Identical rows inside one statement (same date, amount,
 * type and description) are told apart by their occurrence index so a genuine repeat purchase is kept while
 * re-importing the same statement is skipped.
 */
final class CardTransactionKeys {
    private CardTransactionKeys() {
    }

    static final class OccurrenceCounter {
        private final Map<String, Integer> seen = new HashMap<>();

        byte[] next(Long cardId, LocalDate date, BigDecimal amount, CardTransactionType type, String description) {
            String base = base(cardId, date, amount, type, description);
            int occurrence = seen.merge(base, 1, Integer::sum);
            return sha256(base + "|" + occurrence);
        }
    }

    static byte[] manual(Long cardId, String idempotencyKey) {
        return sha256("MANUAL|" + cardId + "|" + idempotencyKey.trim());
    }

    static String normalizeDescription(String description) {
        return description == null ? "" : description.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String base(Long cardId, LocalDate date, BigDecimal amount, CardTransactionType type,
                               String description) {
        return "IMPORT|" + cardId + "|" + date + "|" + amount.stripTrailingZeros().toPlainString() + "|" + type
            + "|" + normalizeDescription(description);
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
