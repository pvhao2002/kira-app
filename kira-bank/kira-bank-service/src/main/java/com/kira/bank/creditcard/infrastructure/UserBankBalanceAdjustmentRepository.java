package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserBankBalanceAdjustment;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserBankBalanceAdjustmentRepository extends Repository<UserBankBalanceAdjustment, Long> {
    UserBankBalanceAdjustment save(UserBankBalanceAdjustment adjustment);

    Optional<UserBankBalanceAdjustment> findFirstByUserIdAndBankIdOrderByBalanceVersionDesc(Long userId, Long bankId);

    @Query("""
        select adjustment from UserBankBalanceAdjustment adjustment
        where adjustment.userId = :userId
          and adjustment.bankId in :bankIds
          and adjustment.balanceVersion = (
              select max(latest.balanceVersion)
              from UserBankBalanceAdjustment latest
              where latest.userId = adjustment.userId
                and latest.bankId = adjustment.bankId
          )
        """)
    List<UserBankBalanceAdjustment> findLatestForBanks(@Param("userId") Long userId,
                                                       @Param("bankIds") Collection<Long> bankIds);
}
