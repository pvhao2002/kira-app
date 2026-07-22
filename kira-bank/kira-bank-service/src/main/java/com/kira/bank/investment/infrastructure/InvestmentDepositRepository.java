package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentDeposit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

import java.util.Optional;

public interface InvestmentDepositRepository extends JpaRepository<InvestmentDeposit, Long> {
    Optional<InvestmentDeposit> findByUserIdAndIdempotencyKey(Long userId, String key);

    Page<InvestmentDeposit> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}
