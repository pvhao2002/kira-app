package com.kira.bank.investment.infrastructure;
import com.kira.bank.investment.domain.InvestmentPlatform;import org.springframework.data.domain.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface InvestmentPlatformRepository extends JpaRepository<InvestmentPlatform,Long>{Page<InvestmentPlatform>findByActiveTrueAndDeletedAtIsNull(Pageable p);}

