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
import java.util.List;
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

    @Query("""
        select new com.kira.bank.investment.application.InvestmentTypeSummary(
            t.transactionType, count(t.id), sum(t.amount)
        )
        from InvestmentAccountTransaction t
        where t.userId = :userId and t.investmentAccountId = :accountId and t.deletedAt is null
          and (:fromDate is null or t.transactionAt >= :fromDate)
          and (:toDate is null or t.transactionAt < :toDate)
          and (:status is null or t.transactionStatus = :status)
        group by t.transactionType
        order by t.transactionType
        """)
    List<com.kira.bank.investment.application.InvestmentTypeSummary> summarize(
        @Param("userId") Long userId, @Param("accountId") Long accountId,
        @Param("fromDate") Instant fromDate, @Param("toDate") Instant toDate,
        @Param("status") InvestmentTransactionStatus status);

    @Query(value = """
        select date(timestampadd(second, unix_timestamp(t.transaction_at) + :zoneOffsetSeconds, '1970-01-01')) as flow_date,
               coalesce(sum(case when t.transaction_type = 'DEPOSIT' then t.amount else 0 end), 0) as deposits,
               coalesce(sum(case when t.transaction_type = 'WITHDRAWAL' then t.amount else 0 end), 0) as withdrawals,
               coalesce(sum(case when t.transaction_type = 'BONUS' then t.amount else 0 end), 0) as bonuses
        from investment_account_transactions t
        where t.user_id = :userId and t.investment_account_id = :accountId and t.deleted_at is null
          and (:fromDate is null or t.transaction_at >= :fromDate)
          and (:toDate is null or t.transaction_at < :toDate)
          and (:status is null or t.transaction_status = :status)
        group by flow_date
        order by flow_date asc
        """, nativeQuery = true)
    List<Object[]> summarizeDaily(
        @Param("userId") Long userId, @Param("accountId") Long accountId,
        @Param("fromDate") Instant fromDate, @Param("toDate") Instant toDate,
        @Param("status") String status, @Param("zoneOffsetSeconds") int zoneOffsetSeconds);

    Optional<InvestmentAccountTransaction> findByIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(
        Long id, Long userId, Long investmentAccountId);
}
