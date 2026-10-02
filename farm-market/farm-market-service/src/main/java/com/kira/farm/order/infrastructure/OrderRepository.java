package com.kira.farm.order.infrastructure;

import com.kira.farm.order.application.StatusCount;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.order.domain.ShopOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<ShopOrder, Long> {
    Optional<ShopOrder> findByCode(String code);

    Optional<ShopOrder> findByCodeAndUserId(String code, Long userId);

    Optional<ShopOrder> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndStatus(Long userId, OrderStatus status);

    Optional<ShopOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    /** Row lock so concurrent status changes/cancellations of one order cannot double-release or double-commit stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from ShopOrder o where o.code = :code")
    Optional<ShopOrder> findForUpdateByCode(@Param("code") String code);

    Page<ShopOrder> findByUserIdAndStatusInOrderByIdDesc(Long userId, Collection<OrderStatus> statuses, Pageable pageable);

    /** q is a lower-cased LIKE pattern; the date window is [from, to). */
    @Query("select o from ShopOrder o where o.branchId in :branchIds and o.status in :statuses "
        + "and o.createdAt >= :from and o.createdAt < :to "
        + "and (lower(o.code) like :q or lower(o.shipRecipient) like :q or o.shipPhone like :q) order by o.id desc")
    Page<ShopOrder> search(@Param("branchIds") Collection<Long> branchIds,
                           @Param("statuses") Collection<OrderStatus> statuses, @Param("from") Instant from,
                           @Param("to") Instant to, @Param("q") String q, Pageable pageable);

    /** Per-status counts for the same filters as search (without the status filter). */
    @Query("select new com.kira.farm.order.application.StatusCount(o.status, count(o)) from ShopOrder o where o.branchId in :branchIds "
        + "and o.createdAt >= :from and o.createdAt < :to "
        + "and (lower(o.code) like :q or lower(o.shipRecipient) like :q or o.shipPhone like :q) group by o.status")
    List<StatusCount> countByStatus(@Param("branchIds") Collection<Long> branchIds, @Param("from") Instant from,
                                 @Param("to") Instant to, @Param("q") String q);

    /** Atomically bumps the per-day counter; read the value with lastInsertId() on the same connection. */
    @Modifying
    @Query(value = "INSERT INTO order_sequences (day_key, seq_value) VALUES (:dayKey, LAST_INSERT_ID(1)) "
        + "ON DUPLICATE KEY UPDATE seq_value = LAST_INSERT_ID(seq_value + 1)", nativeQuery = true)
    int nextSequence(@Param("dayKey") String dayKey);

    @Query(value = "SELECT LAST_INSERT_ID()", nativeQuery = true)
    long lastInsertId();
}
