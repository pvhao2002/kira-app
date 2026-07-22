package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.LedgerEntry;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LedgerRepository extends JpaRepository<LedgerEntry, Long> {
    Page<LedgerEntry> findByUserIdAndInvestmentAccountId(Long userId, Long accountId, Pageable p);
}

