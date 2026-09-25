package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.application.CardCashbackCalculator.ActiveRule;
import com.kira.bank.creditcard.application.CardCashbackCalculator.CardRules;
import com.kira.bank.creditcard.application.CardCashbackCalculator.Period;
import com.kira.bank.creditcard.application.CardCashbackCalculator.RuleUsage;
import com.kira.bank.creditcard.application.CardCashbackCalculator.Usage;
import com.kira.bank.creditcard.domain.CardTransaction;
import com.kira.bank.creditcard.domain.UserBankCreditLimit;
import com.kira.bank.creditcard.domain.UserCreditCard;
import com.kira.bank.creditcard.infrastructure.CardTransactionRepository;
import com.kira.bank.creditcard.infrastructure.UserBankCreditLimitRepository;
import com.kira.bank.creditcard.infrastructure.UserCreditCardRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import static com.kira.bank.creditcard.application.CardTransactionDtos.CardRecommendation;
import static com.kira.bank.creditcard.application.CardTransactionDtos.RecommendationResponse;

/**
 * Ranks the user's active cards for a purchase in one MCC. Estimates respect each rule's remaining cap and the
 * card's monthly cap within the current statement period. Available credit is an estimate: shared bank limit minus
 * the bank balance minus spending logged in the current period that is not on a statement yet.
 */
@Service
@RequiredArgsConstructor
public class CardRecommendationService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final UserCreditCardRepository cards;
    private final UserBankCreditLimitRepository creditLimits;
    private final CardTransactionRepository transactions;
    private final BankBalanceService bankBalances;
    private final CardCashbackCalculator calculator;

    @Transactional(readOnly = true)
    public RecommendationResponse recommend(Long userId, String mccCode, BigDecimal amount) {
        String mcc = mccCode == null ? null : mccCode.trim();
        if (mcc == null || !mcc.matches("\\d{4}"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MCC", "MCC phải gồm 4 chữ số");
        if (amount != null && amount.signum() < 0)
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AMOUNT", "Số tiền không hợp lệ");
        BigDecimal purchase = amount == null ? null : amount.setScale(4, RoundingMode.HALF_UP);

        List<UserCreditCard> activeCards = cards.findByUserIdAndDeletedAtIsNull(userId).stream()
            .filter(card -> "ACTIVE".equals(card.getStatus())).toList();
        if (activeCards.isEmpty()) return new RecommendationResponse(mcc, purchase, List.of());

        List<Long> cardIds = activeCards.stream().map(UserCreditCard::getId).toList();
        Map<Long, CardRules> rulesByCard = calculator.load(cardIds);
        Map<Long, Period> periods = new HashMap<>();
        activeCards.forEach(card -> periods.put(card.getId(), calculator.currentPeriod(card)));
        LocalDate from = periods.values().stream().map(Period::start).min(LocalDate::compareTo).orElseThrow();
        LocalDate to = periods.values().stream().map(Period::end).max(LocalDate::compareTo).orElseThrow();
        Map<Long, List<CardTransaction>> periodTransactions = transactions
            .findByUserCardIdInAndTransactionDateBetweenAndDeletedAtIsNull(cardIds, from, to).stream()
            .filter(transaction -> inPeriod(transaction, periods.get(transaction.getUserCardId())))
            .collect(Collectors.groupingBy(CardTransaction::getUserCardId));
        Map<Long, BigDecimal> availableByBank = availableCredit(userId, activeCards, periodTransactions);

        List<CardRecommendation> result = new ArrayList<>();
        for (UserCreditCard card : activeCards) {
            CardRules cardRules = rulesByCard.get(card.getId());
            Usage usage = calculator.usage(cardRules, periodTransactions.getOrDefault(card.getId(), List.of()));
            Optional<ActiveRule> rule = cardRules.bestForMcc(mcc);
            BigDecimal cardRemaining = calculator.cardRemaining(cardRules, usage);
            BigDecimal available = availableByBank.get(card.getBank().getId());
            List<String> reasons = new ArrayList<>();
            BigDecimal estimate = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
            BigDecimal ruleRemaining = null;
            if (cardRules.rules().isEmpty()) {
                reasons.add("NO_CASHBACK_PROGRAM");
            } else if (rule.isEmpty()) {
                reasons.add("NO_MATCHING_RULE");
            } else {
                RuleUsage ruleUsage = usage.byRule().get(rule.get().ruleId());
                ruleRemaining = ruleUsage == null ? rule.get().cap() : ruleUsage.remaining();
                if (ruleRemaining.signum() == 0) reasons.add("RULE_CAP_REACHED");
                if (cardRemaining != null && cardRemaining.signum() == 0) reasons.add("CARD_CAP_REACHED");
                if (purchase != null) {
                    estimate = calculator.estimate(cardRules, usage, rule.get(), purchase);
                    BigDecimal gross = purchase.multiply(rule.get().rate()).divide(HUNDRED, 4, RoundingMode.HALF_UP);
                    if (estimate.signum() > 0 && estimate.compareTo(gross) < 0) reasons.add("PARTIALLY_CAPPED");
                }
            }
            boolean insufficient = purchase != null && available != null && purchase.compareTo(available) > 0;
            if (insufficient) reasons.add("INSUFFICIENT_CREDIT");
            if (available == null) reasons.add("CREDIT_LIMIT_UNKNOWN");
            Period period = periods.get(card.getId());
            result.add(new CardRecommendation(card.getId(), card.getBank().getId(), card.getBank().getName(),
                card.getBank().getLogoUrl(), card.getNickname(), card.getCardType(), card.getLastFour(),
                card.getCurrency(), rule.map(ActiveRule::ruleId).orElse(null),
                rule.map(ActiveRule::programName).orElse(null), rule.map(ActiveRule::categoryName).orElse(null),
                rule.map(ActiveRule::rate).orElse(null), estimate, rule.map(ActiveRule::cap).orElse(null),
                ruleRemaining, cardRules.monthlyCap(), cardRemaining, available, insufficient,
                period.start(), period.end(), reasons));
        }
        result.sort(Comparator.comparing(CardRecommendation::insufficientCredit)
            .thenComparing(CardRecommendation::estimatedCashback, Comparator.reverseOrder())
            .thenComparing(item -> item.cashbackRate() == null ? BigDecimal.ZERO : item.cashbackRate(),
                Comparator.reverseOrder())
            .thenComparing(item -> item.availableCredit() == null ? BigDecimal.ZERO : item.availableCredit(),
                Comparator.reverseOrder()));
        return new RecommendationResponse(mcc, purchase, result);
    }

    private Map<Long, BigDecimal> availableCredit(Long userId, List<UserCreditCard> activeCards,
                                                  Map<Long, List<CardTransaction>> periodTransactions) {
        Map<Long, BigDecimal> limits = creditLimits.findByUserIdAndDeletedAtIsNull(userId).stream()
            .collect(Collectors.toMap(limit -> limit.getBank().getId(), UserBankCreditLimit::getCreditLimit,
                (first, second) -> first));
        Set<Long> bankIds = activeCards.stream().map(card -> card.getBank().getId()).collect(Collectors.toSet());
        Map<Long, BigDecimal> balances = bankBalances.currentBalances(userId, bankIds);
        Map<Long, BigDecimal> unbilled = new HashMap<>();
        for (UserCreditCard card : activeCards) {
            BigDecimal net = BigDecimal.ZERO;
            for (CardTransaction transaction : periodTransactions.getOrDefault(card.getId(), List.of())) {
                if (transaction.getStatementId() != null) continue;
                net = switch (transaction.getTransactionType()) {
                    case SPENDING, FEE, INTEREST -> net.add(transaction.getAmount());
                    case REFUND, CASHBACK -> net.subtract(transaction.getAmount());
                };
            }
            unbilled.merge(card.getBank().getId(), net, BigDecimal::add);
        }
        Map<Long, BigDecimal> available = new HashMap<>();
        for (Long bankId : bankIds) {
            BigDecimal limit = limits.get(bankId);
            if (limit == null) continue;
            BigDecimal value = limit.subtract(balances.getOrDefault(bankId, BigDecimal.ZERO))
                .subtract(unbilled.getOrDefault(bankId, BigDecimal.ZERO).max(BigDecimal.ZERO));
            available.put(bankId, value.max(BigDecimal.ZERO).setScale(4, RoundingMode.HALF_UP));
        }
        return available;
    }

    private boolean inPeriod(CardTransaction transaction, Period period) {
        return period != null && !transaction.getTransactionDate().isBefore(period.start())
            && !transaction.getTransactionDate().isAfter(period.end());
    }
}
