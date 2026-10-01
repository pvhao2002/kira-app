package com.kira.farm.loyalty.infrastructure;

import com.kira.farm.loyalty.domain.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Long> {
    Optional<Voucher> findByCodeAndUserId(String code, Long userId);

    List<Voucher> findByUserIdOrderByIdDesc(Long userId);

    /** Atomic AVAILABLE -> USED; 0 rows means it was already used, expired or is not the caller's. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE vouchers SET status = 'USED', used_order_id = :orderId WHERE code = :code "
        + "AND user_id = :userId AND status = 'AVAILABLE' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(6))",
        nativeQuery = true)
    int markUsed(@Param("code") String code, @Param("userId") Long userId, @Param("orderId") Long orderId);

    /** Atomic USED -> AVAILABLE for the order that consumed it; 0 rows when nothing to release (idempotent). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE vouchers SET status = 'AVAILABLE', used_order_id = NULL WHERE used_order_id = :orderId "
        + "AND status = 'USED'", nativeQuery = true)
    int release(@Param("orderId") Long orderId);
}
