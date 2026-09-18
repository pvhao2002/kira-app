package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentReconciliationReportEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentReconciliationReportEventRepository extends JpaRepository<InvestmentReconciliationReportEvent, Long> {
    List<InvestmentReconciliationReportEvent> findByReportIdOrderByCreatedAtAscIdAsc(Long reportId);
}
