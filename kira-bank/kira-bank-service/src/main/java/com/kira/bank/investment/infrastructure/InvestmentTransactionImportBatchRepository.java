package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentImportBatchStatus;
import com.kira.bank.investment.domain.InvestmentTransactionImportBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportBatchRepository extends JpaRepository<InvestmentTransactionImportBatch, Long> {
    Optional<InvestmentTransactionImportBatch> findByBatchIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(
        String batchId, Long userId, Long accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select b from InvestmentTransactionImportBatch b
        where b.batchId = :batchId and b.userId = :userId and b.investmentAccountId = :accountId
          and b.deletedAt is null
        """)
    Optional<InvestmentTransactionImportBatch> findOwnedForUpdate(
        @Param("batchId") String batchId, @Param("userId") Long userId, @Param("accountId") Long accountId);

    long countByUserIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(Long userId, Instant since);

    @Query("""
        select b from InvestmentTransactionImportBatch b
        where b.status in :statuses and b.retentionUntil is not null and b.retentionUntil <= :now
        """)
    List<InvestmentTransactionImportBatch> findExpired(
        @Param("statuses") Collection<InvestmentImportBatchStatus> statuses, @Param("now") Instant now);
}
