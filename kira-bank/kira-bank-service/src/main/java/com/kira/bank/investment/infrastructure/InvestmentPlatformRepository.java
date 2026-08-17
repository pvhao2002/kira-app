package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentPlatform;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvestmentPlatformRepository extends JpaRepository<InvestmentPlatform, Long> {
    Page<InvestmentPlatform> findByActiveTrueAndDeletedAtIsNull(Pageable p);
}

