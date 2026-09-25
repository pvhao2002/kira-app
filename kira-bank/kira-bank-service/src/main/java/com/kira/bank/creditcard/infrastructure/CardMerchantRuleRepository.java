package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CardMerchantRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardMerchantRuleRepository extends JpaRepository<CardMerchantRule, Long> {
    List<CardMerchantRule> findByUserIdAndDeletedAtIsNullOrderByPatternAsc(Long userId);

    Optional<CardMerchantRule> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    /** Includes soft-deleted rows so a re-created pattern revives the row instead of breaking the unique key. */
    Optional<CardMerchantRule> findByUserIdAndPattern(Long userId, String pattern);
}
