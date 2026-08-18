package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentAccountTransaction;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface InvestmentAccountTransactionRepository extends JpaRepository<InvestmentAccountTransaction, Long> {
    Optional<InvestmentAccountTransaction> findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(
        Long accountId, String externalTransactionId);

    Optional<InvestmentAccountTransaction> findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(
        Long accountId, byte[] deduplicationKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from InvestmentAccountTransaction t where t.id = :id and t.userId = :userId and t.deletedAt is null")
    Optional<InvestmentAccountTransaction> findOwnedForUpdate(@Param("id") Long id, @Param("userId") Long userId);

    @Query("""
        select t from InvestmentAccountTransaction t
        where t.userId = :userId and t.investmentAccountId = :accountId and t.deletedAt is null
          and (:fromDate is null or t.transactionAt >= :fromDate)
          and (:toDate is null or t.transactionAt < :toDate)
          and (:type is null or t.transactionType = :type)
          and (:status is null or t.transactionStatus = :status)
        """)
    Page<InvestmentAccountTransaction> search(
        @Param("userId") Long userId, @Param("accountId") Long accountId,
        @Param("fromDate") Instant fromDate, @Param("toDate") Instant toDate,
        @Param("type") InvestmentTransactionType type,
        @Param("status") InvestmentTransactionStatus status, Pageable pageable);
}
