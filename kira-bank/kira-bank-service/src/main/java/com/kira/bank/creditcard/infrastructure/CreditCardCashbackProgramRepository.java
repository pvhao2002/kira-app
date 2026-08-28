package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CreditCardCashbackProgram;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CreditCardCashbackProgramRepository extends JpaRepository<CreditCardCashbackProgram, Long> {
    List<CreditCardCashbackProgram> findByUserCardIdInAndDeletedAtIsNullOrderByCreatedAtDesc(Collection<Long> userCardIds);
    Optional<CreditCardCashbackProgram> findByIdAndUserCardIdAndDeletedAtIsNull(Long id, Long userCardId);
}
