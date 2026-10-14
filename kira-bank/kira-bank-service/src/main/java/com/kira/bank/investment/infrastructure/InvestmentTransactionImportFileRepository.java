package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentTransactionImportFile;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportFileRepository extends JpaRepository<InvestmentTransactionImportFile, Long> {
    // No deletedAt filter: the (account, attachment) unique key also covers soft-deleted rows.
    Optional<InvestmentTransactionImportFile> findByInvestmentAccountIdAndAttachmentId(Long accountId, Long attachmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from InvestmentTransactionImportFile f where f.attachmentId = :attachmentId and f.deletedAt is null")
    List<InvestmentTransactionImportFile> findByAttachmentIdForUpdate(@Param("attachmentId") Long attachmentId);

    List<InvestmentTransactionImportFile> findTop20ByInvestmentAccountIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long accountId);

    @Query("""
        select count(f) from InvestmentTransactionImportFile f, InvestmentAccount a
        where a.id = f.investmentAccountId and a.userId = :userId and f.createdAt >= :since
        """)
    long countRecentByUser(@Param("userId") Long userId, @Param("since") Instant since);
}
