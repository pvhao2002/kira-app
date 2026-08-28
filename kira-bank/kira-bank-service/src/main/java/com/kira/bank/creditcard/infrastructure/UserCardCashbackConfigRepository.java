package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserCardCashbackConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserCardCashbackConfigRepository extends JpaRepository<UserCardCashbackConfig, Long> {
    Optional<UserCardCashbackConfig> findByUserCardIdAndDeletedAtIsNull(Long userCardId);
    List<UserCardCashbackConfig> findByUserCardIdInAndDeletedAtIsNull(Collection<Long> userCardIds);
}
