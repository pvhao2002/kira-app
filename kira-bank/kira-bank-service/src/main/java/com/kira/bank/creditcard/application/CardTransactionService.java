package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.application.CardCashbackCalculator.ActiveRule;
import com.kira.bank.creditcard.application.CardCashbackCalculator.CardRules;
import com.kira.bank.creditcard.application.CardCashbackCalculator.Period;
import com.kira.bank.creditcard.application.CardCashbackCalculator.RuleUsage;
import com.kira.bank.creditcard.application.CardCashbackCalculator.Usage;
import com.kira.bank.creditcard.domain.CardTransaction;
import com.kira.bank.creditcard.domain.CardTransactionSource;
import com.kira.bank.creditcard.domain.CardTransactionType;
import com.kira.bank.creditcard.domain.UserCreditCard;
import com.kira.bank.creditcard.infrastructure.CardTransactionRepository;
import com.kira.bank.creditcard.infrastructure.UserCreditCardRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.kira.bank.creditcard.application.CardTransactionDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class CardTransactionService {
    private final CardTransactionRepository transactions;
    private final UserCreditCardRepository cards;
    private final CardCashbackCalculator calculator;

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> list(Long userId, Long cardId, LocalDate fromDate, LocalDate toDate,
                                                  Pageable pageable) {
        ownCard(userId, cardId);
        CardRules cardRules = calculator.load(cardId);
        Page<TransactionResponse> page = transactions.search(userId, cardId, fromDate, toDate, pageable)
            .map(transaction -> response(transaction, cardRules));
        return new PageResponse<>(page.getContent(), new PageMeta(page.getNumber(), page.getSize(),
            page.getTotalElements(), page.getTotalPages()));
    }

    @Transactional
    public TransactionResponse createManual(Long userId, Long cardId, String idempotencyKey,
                                            ManualTransactionRequest request) {
        UserCreditCard card = ownCard(userId, cardId);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100)
            throw bad("IDEMPOTENCY_KEY_REQUIRED", "Thiếu Idempotency-Key hợp lệ");
        CardRules cardRules = calculator.load(cardId);
        requireRule(cardRules, request.cashbackRuleId());
        byte[] key = CardTransactionKeys.manual(cardId, idempotencyKey);
        var existing = transactions.findByUserCardIdAndDedupKey(cardId, key);
        if (existing.isPresent()) return response(existing.get(), cardRules);

        CardTransaction transaction = new CardTransaction();
        transaction.setUserId(userId);
        transaction.setUserCardId(cardId);
        transaction.setTransactionDate(request.transactionDate());
        transaction.setDescription(request.description().trim());
        transaction.setAmount(request.amount().setScale(4, RoundingMode.HALF_UP));
        transaction.setCurrency(card.getCurrency());
        transaction.setTransactionType(request.transactionType() == null
            ? CardTransactionType.SPENDING : request.transactionType());
        transaction.setMccCode(request.mccCode());
        transaction.setCashbackRuleId(request.cashbackRuleId());
        transaction.setSource(CardTransactionSource.MANUAL);
        transaction.setDedupKey(key);
        transaction.setCreatedBy(userId);
        transaction.setUpdatedBy(userId);
        try {
            return response(transactions.saveAndFlush(transaction), cardRules);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "CARD_TRANSACTION_DUPLICATE", "Giao dịch đã được ghi nhận");
        }
    }

    @Transactional
    public TransactionResponse updateCategory(Long userId, Long transactionId, CategoryUpdateRequest request) {
        CardTransaction transaction = owned(userId, transactionId);
        requireVersion(transaction, request.version());
        CardRules cardRules = calculator.load(transaction.getUserCardId());
        requireRule(cardRules, request.cashbackRuleId());
        transaction.setMccCode(request.mccCode());
        transaction.setCashbackRuleId(request.cashbackRuleId());
        transaction.setUpdatedBy(userId);
        return response(save(transaction), cardRules);
    }

    @Transactional
    public void delete(Long userId, Long transactionId, Long version) {
        CardTransaction transaction = owned(userId, transactionId);
        requireVersion(transaction, version);
        transaction.setDeletedAt(Instant.now());
        transaction.setUpdatedBy(userId);
        save(transaction);
    }

    @Transactional(readOnly = true)
    public CashbackProgressResponse progress(Long userId, Long cardId) {
        UserCreditCard card = ownCard(userId, cardId);
        CardRules cardRules = calculator.load(cardId);
        Period period = calculator.currentPeriod(card);
        Usage usage = calculator.usage(cardRules, transactions.findByUserCardIdInAndTransactionDateBetweenAndDeletedAtIsNull(
            List.of(cardId), period.start(), period.end()));
        List<GroupProgress> groups = new ArrayList<>();
        for (Map.Entry<Long, RuleUsage> entry : usage.byRule().entrySet()) {
            RuleUsage ruleUsage = entry.getValue();
            ActiveRule rule = ruleUsage.rule();
            groups.add(new GroupProgress(rule.ruleId(), rule.programId(), rule.programName(), rule.categoryName(),
                rule.rate(), ruleUsage.spent(), ruleUsage.earned(), rule.cap(), ruleUsage.remaining(),
                List.copyOf(rule.mccCodes())));
        }
        return new CashbackProgressResponse(cardId, card.getCurrency(), period.start(), period.end(),
            cardRules.monthlyCap(), usage.cardEarned(), calculator.cardRemaining(cardRules, usage),
            usage.unassignedSpending(), groups);
    }

    private TransactionResponse response(CardTransaction transaction, CardRules cardRules) {
        String category = cardRules.ruleFor(transaction).map(ActiveRule::categoryName).orElse(null);
        return new TransactionResponse(transaction.getId(), transaction.getUserCardId(), transaction.getStatementId(),
            transaction.getImportId(), transaction.getTransactionDate(), transaction.getPostingDate(),
            transaction.getDescription(), transaction.getAmount(), transaction.getCurrency(),
            transaction.getTransactionType(), transaction.getMccCode(), transaction.getCashbackRuleId(), category,
            transaction.getSource(), transaction.getVersion(), transaction.getCreatedAt());
    }

    private void requireRule(CardRules cardRules, Long ruleId) {
        if (ruleId != null && cardRules.byId(ruleId).isEmpty())
            throw bad("CASHBACK_RULE_NOT_FOUND", "Nhóm cashback không thuộc thẻ này");
    }

    private void requireVersion(CardTransaction transaction, Long version) {
        if (version == null || version != transaction.getVersion())
            throw new ApiException(HttpStatus.CONFLICT, "CARD_TRANSACTION_VERSION_CONFLICT",
                "Giao dịch đã được cập nhật, vui lòng tải lại");
    }

    private CardTransaction save(CardTransaction transaction) {
        try {
            return transactions.saveAndFlush(transaction);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "CARD_TRANSACTION_VERSION_CONFLICT",
                "Giao dịch đã được cập nhật, vui lòng tải lại");
        }
    }

    private CardTransaction owned(Long userId, Long transactionId) {
        return transactions.findByIdAndUserIdAndDeletedAtIsNull(transactionId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CARD_TRANSACTION_NOT_FOUND",
                "Không tìm thấy giao dịch"));
    }

    private UserCreditCard ownCard(Long userId, Long cardId) {
        return cards.findByIdAndUserIdAndDeletedAtIsNull(cardId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_CARD_NOT_FOUND", "Không tìm thấy thẻ"));
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
