package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CreditCardCashbackRuleMcc;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CreditCardCashbackRuleMccRepository extends JpaRepository<CreditCardCashbackRuleMcc, Long> {
    List<CreditCardCashbackRuleMcc> findByRuleIdInAndDeletedAtIsNull(Collection<Long> ruleIds);
    List<CreditCardCashbackRuleMcc> findByRuleId(Long ruleId);
    List<CreditCardCashbackRuleMcc> findByRuleIdIn(Collection<Long> ruleIds);
}
