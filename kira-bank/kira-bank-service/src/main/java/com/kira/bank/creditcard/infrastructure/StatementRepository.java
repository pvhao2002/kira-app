package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.Statement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StatementRepository extends JpaRepository<Statement, Long> {
    Optional<Statement> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Page<Statement> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);

    Optional<Statement> findFirstByUserCardIdAndStatementDateBetweenAndDeletedAtIsNullOrderByStatementDateDesc(
        Long userCardId, LocalDate from, LocalDate to);

    List<Statement> findByUserIdAndUserCardIdInAndStatementDateBetweenAndDeletedAtIsNull(
        Long userId, Collection<Long> userCardIds, LocalDate from, LocalDate to);

    Optional<Statement> findByIdAndUserIdAndUserCardIdAndDeletedAtIsNull(
        Long id, Long userId, Long userCardId);

    @Query("""
        select statement from Statement statement
        where statement.userId = :userId
          and statement.userCardId in :userCardIds
          and statement.deletedAt is null
          and (
                statement.status = 'NEEDS_INPUT'
                or (
                    statement.status in ('OPEN', 'UNPAID', 'PARTIALLY_PAID')
                    and statement.remainingAmount > 0
                )
          )
        order by statement.statementDate desc, statement.id desc
        """)
    List<Statement> findOutstandingForCards(@Param("userId") Long userId,
                                            @Param("userCardIds") Collection<Long> userCardIds);

    @Query(value = """
        select user_card_id as userCardId,
               coalesce(sum(case
                   when status not in ('PAID', 'CANCELLED') and remaining_amount > 0
                       then statement_balance else 0 end), 0) as statementDebt,
               coalesce(sum(case
                   when status not in ('PAID', 'CANCELLED') and remaining_amount > 0
                       then remaining_amount else 0 end), 0) as currentBalance
        from statements
        where user_id = :userId
          and user_card_id in (:userCardIds)
          and deleted_at is null
        group by user_card_id
        """, nativeQuery = true)
    List<CardDebtTotals> findDebtTotalsForCards(@Param("userId") Long userId,
                                                @Param("userCardIds") Collection<Long> userCardIds);

    @Query(value = """
        select user_card.bank_id as bankId,
               coalesce(sum(case
                   when statement.status not in ('PAID', 'CANCELLED') and statement.remaining_amount > 0
                       then statement.remaining_amount else 0 end), 0) as currentBalance
        from user_credit_cards user_card
        left join statements statement
          on statement.user_card_id = user_card.id
         and statement.user_id = :userId
         and statement.deleted_at is null
        where user_card.user_id = :userId
          and user_card.bank_id in (:bankIds)
          and user_card.deleted_at is null
        group by user_card.bank_id
        """, nativeQuery = true)
    List<BankCurrentBalance> findCurrentBalancesForBanks(@Param("userId") Long userId,
                                                         @Param("bankIds") Collection<Long> bankIds);

    interface CardDebtTotals {
        Long getUserCardId();

        BigDecimal getStatementDebt();

        BigDecimal getCurrentBalance();
    }

    interface BankCurrentBalance {
        Long getBankId();

        BigDecimal getCurrentBalance();
    }
}
