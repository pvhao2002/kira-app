package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CreditCardCashbackRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CreditCardCashbackRuleRepository extends JpaRepository<CreditCardCashbackRule, Long> {
    List<CreditCardCashbackRule> findByProgramIdInAndDeletedAtIsNullOrderByProgramIdAscDisplayOrderAsc(
        Collection<Long> programIds);
    List<CreditCardCashbackRule> findByProgramIdAndDeletedAtIsNullOrderByDisplayOrderAsc(Long programId);
}
