package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.UserCreditCard;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserCreditCardRepository extends JpaRepository<UserCreditCard, Long> {
    @EntityGraph(attributePaths = "bank")
    Optional<UserCreditCard> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    @EntityGraph(attributePaths = "bank")
    Page<UserCreditCard> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);

    @EntityGraph(attributePaths = "bank")
    @Query("""
        select c from UserCreditCard c
        where c.userId = :userId
          and c.deletedAt is null
          and (:search = ''
            or lower(c.nickname) like lower(concat('%', :search, '%'))
            or lower(c.cardType) like lower(concat('%', :search, '%'))
            or lower(c.lastFour) like lower(concat('%', :search, '%'))
            or lower(c.bank.name) like lower(concat('%', :search, '%'))
            or lower(c.bank.shortName) like lower(concat('%', :search, '%'))
            or lower(c.bank.code) like lower(concat('%', :search, '%')))
        """)
    Page<UserCreditCard> search(@Param("userId") Long userId, @Param("search") String search, Pageable p);

    @EntityGraph(attributePaths = "bank")
    List<UserCreditCard> findByUserIdAndDeletedAtIsNull(Long userId);

    Slice<UserCreditCard> findByStatusAndDeletedAtIsNull(String status, Pageable p);
}
