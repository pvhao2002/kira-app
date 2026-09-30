package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.*;
import com.kira.bank.creditcard.infrastructure.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cashback arithmetic shared by statement import, progress and card recommendation.
 * A rule earns {@code min(net spending x rate / 100, maxCashbackAmount)} per statement period, where net spending is
 * SPENDING minus REFUND (never below zero); the card total is additionally capped by the monthly cashback cap.
 * Only active programs count. When several rules contain one MCC the highest rate wins.
 */
@Component
@RequiredArgsConstructor
public class CardCashbackCalculator {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final UserCardCashbackConfigRepository configs;
    private final CreditCardCashbackProgramRepository programs;
    private final CreditCardCashbackRuleRepository rules;
    private final CreditCardCashbackRuleMccRepository mccs;

    @Value("${CARD_STATEMENT_JOB_TIME_ZONE:Asia/Bangkok}")
    private String timeZone;

    public record ActiveRule(Long ruleId, Long programId, String programName, String categoryName,
                             BigDecimal rate, BigDecimal cap, Set<String> mccCodes) {
    }

    public record CardRules(Long cardId, BigDecimal monthlyCap, List<ActiveRule> rules) {
        public Optional<ActiveRule> byId(Long ruleId) {
            if (ruleId == null) return Optional.empty();
            return rules.stream().filter(rule -> rule.ruleId().equals(ruleId)).findFirst();
        }

        public Optional<ActiveRule> bestForMcc(String mcc) {
            if (mcc == null) return Optional.empty();
            return rules.stream().filter(rule -> rule.mccCodes().contains(mcc))
                .max(Comparator.comparing(ActiveRule::rate));
        }

        /** Explicit rule assignment wins; otherwise the MCC decides. */
        public Optional<ActiveRule> ruleFor(CardTransaction transaction) {
            Optional<ActiveRule> explicit = byId(transaction.getCashbackRuleId());
            return explicit.isPresent() ? explicit : bestForMcc(transaction.getMccCode());
        }

        public Optional<ActiveRule> byCategoryName(String name) {
            if (name == null || name.isBlank()) return Optional.empty();
            String wanted = name.trim().toLowerCase(Locale.ROOT);
            return rules.stream().filter(rule -> rule.categoryName().trim().toLowerCase(Locale.ROOT).equals(wanted))
                .findFirst();
        }
    }

    public record RuleUsage(ActiveRule rule, BigDecimal spent, BigDecimal earned) {
        public BigDecimal remaining() {
            return rule.cap().subtract(earned).max(BigDecimal.ZERO).setScale(4, RoundingMode.HALF_UP);
        }
    }

    public record Usage(Map<Long, RuleUsage> byRule, BigDecimal cardEarned, BigDecimal unassignedSpending) {
    }

    public record Period(LocalDate start, LocalDate end) {
    }

    @Transactional(readOnly = true)
    public Map<Long, CardRules> load(Collection<Long> cardIds) {
        if (cardIds.isEmpty()) return Map.of();
        Map<Long, BigDecimal> caps = configs.findByUserCardIdInAndDeletedAtIsNull(cardIds).stream()
            .collect(Collectors.toMap(UserCardCashbackConfig::getUserCardId, UserCardCashbackConfig::getMonthlyCashbackCap,
                (first, second) -> first));
        List<CreditCardCashbackProgram> activePrograms =
            programs.findByUserCardIdInAndDeletedAtIsNullOrderByCreatedAtDesc(cardIds).stream()
                .filter(CreditCardCashbackProgram::isActive).toList();
        Map<Long, CreditCardCashbackProgram> programById = activePrograms.stream()
            .collect(Collectors.toMap(CreditCardCashbackProgram::getId, Function.identity()));
        List<CreditCardCashbackRule> activeRules = programById.isEmpty() ? List.of()
            : rules.findByProgramIdInAndDeletedAtIsNullOrderByProgramIdAscDisplayOrderAsc(programById.keySet());
        Map<Long, Set<String>> mccsByRule = activeRules.isEmpty() ? Map.of()
            : mccs.findByRuleIdInAndDeletedAtIsNull(activeRules.stream().map(CreditCardCashbackRule::getId).toList())
            .stream().collect(Collectors.groupingBy(CreditCardCashbackRuleMcc::getRuleId,
                Collectors.mapping(CreditCardCashbackRuleMcc::getMccCode, Collectors.toCollection(TreeSet::new))));

        Map<Long, List<ActiveRule>> rulesByCard = new HashMap<>();
        for (CreditCardCashbackRule rule : activeRules) {
            CreditCardCashbackProgram program = programById.get(rule.getProgramId());
            rulesByCard.computeIfAbsent(program.getUserCardId(), id -> new ArrayList<>()).add(new ActiveRule(
                rule.getId(), program.getId(), program.getName(), rule.getCategoryName(), rule.getCashbackRate(),
                rule.getMaxCashbackAmount(), mccsByRule.getOrDefault(rule.getId(), Set.of())));
        }
        Map<Long, CardRules> result = new HashMap<>();
        for (Long cardId : cardIds) {
            result.put(cardId, new CardRules(cardId, caps.get(cardId), rulesByCard.getOrDefault(cardId, List.of())));
        }
        return result;
    }

    public CardRules load(Long cardId) {
        return load(List.of(cardId)).get(cardId);
    }

    public Usage usage(CardRules cardRules, Collection<CardTransaction> transactions) {
        Map<Long, BigDecimal> netByRule = new LinkedHashMap<>();
        BigDecimal unassigned = BigDecimal.ZERO;
        for (CardTransaction transaction : transactions) {
            BigDecimal signed = switch (transaction.getTransactionType()) {
                case SPENDING -> transaction.getAmount();
                case REFUND -> transaction.getAmount().negate();
                default -> null;
            };
            if (signed == null) continue;
            Optional<ActiveRule> rule = cardRules.ruleFor(transaction);
            if (rule.isPresent()) netByRule.merge(rule.get().ruleId(), signed, BigDecimal::add);
            else unassigned = unassigned.add(signed);
        }
        Map<Long, RuleUsage> byRule = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (ActiveRule rule : cardRules.rules()) {
            BigDecimal spent = money(netByRule.getOrDefault(rule.ruleId(), BigDecimal.ZERO).max(BigDecimal.ZERO));
            BigDecimal earned = money(spent.multiply(rule.rate()).divide(HUNDRED, 4, RoundingMode.HALF_UP)
                .min(rule.cap()));
            byRule.put(rule.ruleId(), new RuleUsage(rule, spent, earned));
            total = total.add(earned);
        }
        if (cardRules.monthlyCap() != null) total = total.min(cardRules.monthlyCap());
        return new Usage(byRule, money(total), money(unassigned.max(BigDecimal.ZERO)));
    }

    /** Cashback a new purchase would earn on top of the existing usage, bounded by the remaining caps. */
    public BigDecimal estimate(CardRules cardRules, Usage usage, ActiveRule rule, BigDecimal amount) {
        if (rule == null || amount == null || amount.signum() <= 0) return money(BigDecimal.ZERO);
        RuleUsage ruleUsage = usage.byRule().get(rule.ruleId());
        BigDecimal ruleRemaining = ruleUsage == null ? rule.cap() : ruleUsage.remaining();
        BigDecimal gross = amount.multiply(rule.rate()).divide(HUNDRED, 4, RoundingMode.HALF_UP);
        BigDecimal result = gross.min(ruleRemaining);
        BigDecimal cardRemaining = cardRemaining(cardRules, usage);
        if (cardRemaining != null) result = result.min(cardRemaining);
        return money(result.max(BigDecimal.ZERO));
    }

    public BigDecimal cardRemaining(CardRules cardRules, Usage usage) {
        if (cardRules.monthlyCap() == null) return null;
        return money(cardRules.monthlyCap().subtract(usage.cardEarned()).max(BigDecimal.ZERO));
    }

    /** Current statement period: the day after last statement day up to the next statement day, inclusive. */
    public Period currentPeriod(UserCreditCard card) {
        LocalDate today = today();
        YearMonth month = YearMonth.from(today);
        LocalDate thisStatement = dayOfMonth(month, card.getStatementDay());
        if (today.isAfter(thisStatement)) {
            return new Period(thisStatement.plusDays(1), dayOfMonth(month.plusMonths(1), card.getStatementDay()));
        }
        return new Period(dayOfMonth(month.minusMonths(1), card.getStatementDay()).plusDays(1), thisStatement);
    }

    public LocalDate today() {
        return LocalDate.now(ZoneId.of(timeZone));
    }

    private LocalDate dayOfMonth(YearMonth month, int day) {
        return month.atDay(Math.min(day, month.lengthOfMonth()));
    }

    static BigDecimal money(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }
}
