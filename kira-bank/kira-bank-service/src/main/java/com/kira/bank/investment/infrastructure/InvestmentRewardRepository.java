package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentReward;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvestmentRewardRepository extends JpaRepository<InvestmentReward, Long> {
    Optional<InvestmentReward> findByUserIdAndIdempotencyKey(Long user, String key);

    Page<InvestmentReward> findByUserIdAndDeletedAtIsNull(Long user, Pageable p);
}
