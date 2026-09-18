package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentReconciliationReport;
import com.kira.bank.investment.domain.InvestmentReconciliationReportStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface InvestmentReconciliationReportRepository extends JpaRepository<InvestmentReconciliationReport, Long> {
    Page<InvestmentReconciliationReport> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);

    Page<InvestmentReconciliationReport> findByDeletedAtIsNull(Pageable pageable);

    @Query("select r from InvestmentReconciliationReport r where r.deletedAt is null and (:status is null or r.status = :status)")
    Page<InvestmentReconciliationReport> findByStatusOrAll(@Param("status") InvestmentReconciliationReportStatus status, Pageable pageable);

    Optional<InvestmentReconciliationReport> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InvestmentReconciliationReport r where r.id = :id and r.deletedAt is null")
    Optional<InvestmentReconciliationReport> findForUpdate(@Param("id") Long id);

    boolean existsByUserIdAndTransactionIdAndStatusInAndDeletedAtIsNull(
        Long userId, Long transactionId, Collection<InvestmentReconciliationReportStatus> statuses);
}
