package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserBankCreditLimit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface UserBankCreditLimitRepository extends JpaRepository<UserBankCreditLimit, Long> {
    @EntityGraph(attributePaths = "bank")
    Optional<UserBankCreditLimit> findByUserIdAndBankIdAndDeletedAtIsNull(Long userId, Long bankId);

    @EntityGraph(attributePaths = "bank")
    List<UserBankCreditLimit> findByUserIdAndDeletedAtIsNull(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "bank")
    @Query("""
        select creditLimit from UserBankCreditLimit creditLimit
        where creditLimit.userId = :userId
          and creditLimit.bank.id = :bankId
          and creditLimit.deletedAt is null
        """)
    Optional<UserBankCreditLimit> findForBalanceUpdate(@Param("userId") Long userId,
                                                       @Param("bankId") Long bankId);

    @Modifying
    @Query(value = """
        update user_bank_credit_limits
        set balance_version = :nextVersion,
            updated_by = :userId
        where id = :id
          and balance_version = :expectedVersion
        """, nativeQuery = true)
    int updateBalanceVersion(@Param("id") Long id,
                             @Param("userId") Long userId,
                             @Param("expectedVersion") long expectedVersion,
                             @Param("nextVersion") long nextVersion);
}
