package com.kira.bank.dashboard.application;

import com.kira.bank.creditcard.domain.UserBankCreditLimit;
import com.kira.bank.creditcard.domain.UserCreditCard;
import com.kira.bank.creditcard.infrastructure.StatementRepository;
import com.kira.bank.creditcard.infrastructure.UserBankCreditLimitRepository;
import com.kira.bank.creditcard.infrastructure.UserCreditCardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

import static com.kira.bank.dashboard.application.CreditCardDashboardDtos.*;

@Service
@RequiredArgsConstructor
public class CreditCardDashboardService {
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final String DEFAULT_CURRENCY = "VND";

    private final UserCreditCardRepository cards;
    private final UserBankCreditLimitRepository creditLimits;
    private final StatementRepository statements;

    @Transactional(readOnly = true)
    public CreditCardDashboardResponse dashboard(Long userId) {
        List<UserCreditCard> userCards = cards.findByUserIdAndDeletedAtIsNull(userId);
        if (userCards.isEmpty()) {
            return new CreditCardDashboardResponse(zero(), zero(), zero(), zero(), rateZero(),
                DEFAULT_CURRENCY, List.of());
        }

        Map<Long, StatementRepository.CardDebtTotals> debtByCard = debtByCard(userId, userCards);
        Map<Long, UserBankCreditLimit> limitByBank = creditLimits.findByUserIdAndDeletedAtIsNull(userId)
            .stream().collect(java.util.stream.Collectors.toMap(limit -> limit.getBank().getId(), limit -> limit));
        Map<Long, List<UserCreditCard>> cardsByBank = new LinkedHashMap<>();
        userCards.forEach(card -> cardsByBank.computeIfAbsent(card.getBank().getId(), ignored -> new ArrayList<>())
            .add(card));

        List<BankDebtResponse> bankRows = cardsByBank.values().stream()
            .map(bankCards -> bankRow(bankCards, debtByCard,
                requireLimit(limitByBank, bankCards.getFirst().getBank().getId())))
            .sorted(Comparator.comparing(BankDebtResponse::utilizationRate).reversed()
                .thenComparing(BankDebtResponse::bankName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        BigDecimal totalCreditLimit = sum(bankRows.stream().map(BankDebtResponse::totalCreditLimit).toList());
        BigDecimal totalStatementDebt = sum(bankRows.stream().map(BankDebtResponse::statementDebt).toList());
        BigDecimal currentBalance = sum(bankRows.stream().map(BankDebtResponse::currentBalance).toList());
        return new CreditCardDashboardResponse(totalCreditLimit, totalStatementDebt, currentBalance,
            money(totalCreditLimit.subtract(currentBalance)), utilization(currentBalance, totalCreditLimit),
            userCards.getFirst().getCurrency(), bankRows);
    }

    private BankDebtResponse bankRow(List<UserCreditCard> bankCards,
                                     Map<Long, StatementRepository.CardDebtTotals> debtByCard,
                                     UserBankCreditLimit creditLimit) {
        List<CardDebtResponse> cardRows = bankCards.stream()
            .map(card -> cardRow(card, debtByCard.get(card.getId())))
            .sorted(Comparator.comparing(CardDebtResponse::nickname, String.CASE_INSENSITIVE_ORDER))
            .toList();
        BigDecimal totalCreditLimit = money(creditLimit.getCreditLimit());
        BigDecimal statementDebt = sum(cardRows.stream().map(CardDebtResponse::statementDebt).toList());
        BigDecimal currentBalance = sum(bankCards.stream()
            .map(card -> currentBalance(debtByCard.get(card.getId())))
            .toList());
        UserCreditCard first = bankCards.getFirst();
        String bankName = first.getBank().getShortName() == null || first.getBank().getShortName().isBlank()
            ? first.getBank().getName() : first.getBank().getShortName();
        return new BankDebtResponse(first.getBank().getId(), bankName, first.getBank().getLogoUrl(),
            cardRows.size(), totalCreditLimit, creditLimit.getVersion(), statementDebt, currentBalance,
            money(totalCreditLimit.subtract(currentBalance)), utilization(currentBalance, totalCreditLimit),
            creditLimit.getCurrency(), cardRows);
    }

    private CardDebtResponse cardRow(UserCreditCard card, StatementRepository.CardDebtTotals debt) {
        BigDecimal statementDebt = debt == null ? zero() : money(debt.getStatementDebt());
        return new CardDebtResponse(card.getId(), card.getNickname(), card.getLastFour(), card.getStatus(),
            statementDebt, card.getCurrency());
    }

    private BigDecimal currentBalance(StatementRepository.CardDebtTotals debt) {
        return debt == null ? zero() : money(debt.getCurrentBalance());
    }

    private UserBankCreditLimit requireLimit(Map<Long, UserBankCreditLimit> limitByBank, Long bankId) {
        UserBankCreditLimit creditLimit = limitByBank.get(bankId);
        if (creditLimit == null) {
            throw new IllegalStateException("Missing shared credit limit for bank " + bankId);
        }
        return creditLimit;
    }

    private Map<Long, StatementRepository.CardDebtTotals> debtByCard(Long userId,
                                                                     List<UserCreditCard> userCards) {
        Map<Long, StatementRepository.CardDebtTotals> result = new HashMap<>();
        statements.findDebtTotalsForCards(userId, userCards.stream().map(UserCreditCard::getId).toList())
            .forEach(total -> result.put(total.getUserCardId(), total));
        return result;
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return money(values.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private BigDecimal utilization(BigDecimal balance, BigDecimal creditLimit) {
        if (creditLimit.signum() == 0) {
            return rateZero();
        }
        return balance.multiply(ONE_HUNDRED).divide(creditLimit, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal rateZero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
