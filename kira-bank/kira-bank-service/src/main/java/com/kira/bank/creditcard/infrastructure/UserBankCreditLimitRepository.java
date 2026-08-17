package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserBankCreditLimit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserBankCreditLimitRepository extends JpaRepository<UserBankCreditLimit, Long> {
    @EntityGraph(attributePaths = "bank")
    Optional<UserBankCreditLimit> findByUserIdAndBankIdAndDeletedAtIsNull(Long userId, Long bankId);

    @EntityGraph(attributePaths = "bank")
    List<UserBankCreditLimit> findByUserIdAndDeletedAtIsNull(Long userId);
}
