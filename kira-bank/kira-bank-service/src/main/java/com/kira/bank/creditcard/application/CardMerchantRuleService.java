package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.CardMerchantRule;
import com.kira.bank.creditcard.domain.CardTransaction;
import com.kira.bank.creditcard.infrastructure.CardMerchantRuleRepository;
import com.kira.bank.creditcard.infrastructure.CardTransactionRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import static com.kira.bank.creditcard.application.CardTransactionDtos.*;

/**
 * Per-user "description contains pattern → MCC" rules. Vietnamese statements rarely print an MCC, so these rules are
 * what lets imported rows land in the right cashback group without manual picking. The longest matching pattern wins.
 */
@Service
@RequiredArgsConstructor
public class CardMerchantRuleService {
    static final int MIN_PATTERN = 2;
    static final int MAX_PATTERN = 100;

    private final CardMerchantRuleRepository rules;
    private final CardTransactionRepository transactions;

    /** Snapshot of a user's rules for matching many descriptions in one pass. */
    public static final class Matcher {
        private final List<CardMerchantRule> ordered;

        private Matcher(List<CardMerchantRule> rules) {
            this.ordered = rules.stream()
                .sorted(Comparator.comparingInt((CardMerchantRule rule) -> rule.getPattern().length()).reversed())
                .toList();
        }

        public Optional<CardMerchantRule> match(String description) {
            String normalized = CardTransactionKeys.normalizeDescription(description);
            if (normalized.isEmpty()) return Optional.empty();
            return ordered.stream().filter(rule -> normalized.contains(rule.getPattern())).findFirst();
        }

        public Optional<String> mccFor(String description) {
            return match(description).map(CardMerchantRule::getMccCode);
        }
    }

    @Transactional(readOnly = true)
    public Matcher matcher(Long userId) {
        return new Matcher(rules.findByUserIdAndDeletedAtIsNullOrderByPatternAsc(userId));
    }

    @Transactional(readOnly = true)
    public List<MerchantRuleResponse> list(Long userId) {
        return rules.findByUserIdAndDeletedAtIsNullOrderByPatternAsc(userId).stream().map(this::response).toList();
    }

    @Transactional
    public MerchantRuleSaveResponse create(Long userId, MerchantRuleRequest request) {
        CardMerchantRule rule = upsert(userId, request.pattern(), request.mccCode(), request.label(), true);
        int updated = Boolean.TRUE.equals(request.applyToExisting()) ? applyToExisting(userId, rule) : 0;
        return new MerchantRuleSaveResponse(response(rule), updated);
    }

    @Transactional
    public MerchantRuleResponse update(Long userId, Long id, MerchantRuleRequest request) {
        CardMerchantRule rule = owned(userId, id);
        requireVersion(rule, request.version());
        String pattern = normalizePattern(request.pattern());
        rules.findByUserIdAndPattern(userId, pattern)
            .filter(other -> !other.getId().equals(rule.getId()))
            .ifPresent(other -> {
                if (other.getDeletedAt() == null) throw duplicate();
                // A soft-deleted row still holds the unique key; free it so this rule can take the pattern.
                other.setPattern("~" + other.getId());
                rules.saveAndFlush(other);
            });
        rule.setPattern(pattern);
        rule.setMccCode(request.mccCode());
        rule.setLabel(blankToNull(request.label()));
        rule.setUpdatedBy(userId);
        return response(save(rule));
    }

    @Transactional
    public void delete(Long userId, Long id, Long version) {
        CardMerchantRule rule = owned(userId, id);
        requireVersion(rule, version);
        rule.setDeletedAt(Instant.now());
        rule.setUpdatedBy(userId);
        save(rule);
    }

    /**
     * Creates or refreshes a rule. With {@code rejectExisting} an active rule for the same pattern is a conflict;
     * without it (remembering from statement review) the rule is overwritten with the newer choice.
     */
    @Transactional
    public CardMerchantRule upsert(Long userId, String rawPattern, String mccCode, String label, boolean rejectExisting) {
        String pattern = normalizePattern(rawPattern);
        CardMerchantRule rule = rules.findByUserIdAndPattern(userId, pattern).orElse(null);
        if (rule != null && rule.getDeletedAt() == null && rejectExisting) throw duplicate();
        if (rule == null) {
            rule = new CardMerchantRule();
            rule.setUserId(userId);
            rule.setPattern(pattern);
            rule.setCreatedBy(userId);
        }
        rule.setDeletedAt(null);
        rule.setMccCode(mccCode);
        if (label != null || rule.getLabel() == null) rule.setLabel(blankToNull(label));
        rule.setUpdatedBy(userId);
        return save(rule);
    }

    private int applyToExisting(Long userId, CardMerchantRule rule) {
        int updated = 0;
        for (CardTransaction transaction :
            transactions.findByUserIdAndMccCodeIsNullAndCashbackRuleIdIsNullAndDeletedAtIsNull(userId)) {
            if (!CardTransactionKeys.normalizeDescription(transaction.getDescription()).contains(rule.getPattern())) continue;
            transaction.setMccCode(rule.getMccCode());
            transaction.setUpdatedBy(userId);
            transactions.save(transaction);
            updated++;
        }
        return updated;
    }

    static String normalizePattern(String raw) {
        String pattern = CardTransactionKeys.normalizeDescription(raw);
        if (pattern.length() < MIN_PATTERN || pattern.length() > MAX_PATTERN)
            throw new ApiException(HttpStatus.BAD_REQUEST, "MERCHANT_RULE_PATTERN_INVALID",
                "Từ khoá cửa hàng phải có từ 2 đến 100 ký tự");
        return pattern;
    }

    private MerchantRuleResponse response(CardMerchantRule rule) {
        return new MerchantRuleResponse(rule.getId(), rule.getPattern(), rule.getMccCode(), rule.getLabel(),
            rule.getVersion(), rule.getUpdatedAt());
    }

    private CardMerchantRule save(CardMerchantRule rule) {
        try {
            return rules.saveAndFlush(rule);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "MERCHANT_RULE_VERSION_CONFLICT",
                "Quy tắc đã được cập nhật, vui lòng tải lại");
        }
    }

    private void requireVersion(CardMerchantRule rule, Long version) {
        if (version == null || version != rule.getVersion())
            throw new ApiException(HttpStatus.CONFLICT, "MERCHANT_RULE_VERSION_CONFLICT",
                "Quy tắc đã được cập nhật, vui lòng tải lại");
    }

    private CardMerchantRule owned(Long userId, Long id) {
        return rules.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MERCHANT_RULE_NOT_FOUND",
                "Không tìm thấy quy tắc cửa hàng"));
    }

    private ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "MERCHANT_RULE_DUPLICATE", "Từ khoá cửa hàng này đã có quy tắc");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
