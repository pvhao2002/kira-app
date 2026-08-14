package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserCreditCard;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.Optional;

public interface UserCreditCardRepository extends JpaRepository<UserCreditCard, Long> {
    @EntityGraph(attributePaths = "bank")
    Optional<UserCreditCard> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    @EntityGraph(attributePaths = "bank")
    Page<UserCreditCard> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);

    Slice<UserCreditCard> findByStatusAndDeletedAtIsNull(String status, Pageable p);
}
