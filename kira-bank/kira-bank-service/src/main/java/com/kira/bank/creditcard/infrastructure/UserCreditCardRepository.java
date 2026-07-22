package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserCreditCard;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserCreditCardRepository extends JpaRepository<UserCreditCard, Long> {
    Optional<UserCreditCard> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Page<UserCreditCard> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}

