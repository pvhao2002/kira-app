package com.kira.farm.promotion.infrastructure;

import com.kira.farm.promotion.domain.Promotion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
    Optional<Promotion> findByCode(String code);

    boolean existsByCode(String code);

    @Query("select p from Promotion p where upper(p.code) like :q")
    Page<Promotion> searchAll(@Param("q") String q, Pageable pageable);

    /** Promotions that apply everywhere or to at least one of the given branches. */
    @Query("select p from Promotion p where upper(p.code) like :q and (p.allBranches = true or p.id in "
        + "(select p2.id from Promotion p2 join p2.branchIds b where b in :ids))")
    Page<Promotion> searchVisible(@Param("ids") Collection<Long> ids, @Param("q") String q, Pageable pageable);

    @Query(value = "select count(*) from promotion_redemptions where promotion_id = :promotionId and user_id = :userId",
        nativeQuery = true)
    long countRedemptions(@Param("promotionId") Long promotionId, @Param("userId") Long userId);

    @Query(value = "select count(*) from promotion_redemptions where promotion_id = :promotionId", nativeQuery = true)
    long countAllRedemptions(@Param("promotionId") Long promotionId);

    /** Idempotent per (promotion, order): returns 0 when the order already redeemed this promotion. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "INSERT IGNORE INTO promotion_redemptions (promotion_id, user_id, order_id, discount, created_at) "
        + "VALUES (:promotionId, :userId, :orderId, :discount, UTC_TIMESTAMP(6))", nativeQuery = true)
    int insertRedemption(@Param("promotionId") Long promotionId, @Param("userId") Long userId,
                         @Param("orderId") Long orderId, @Param("discount") long discount);

    /** Atomic usage counter: only increments while under the global usage limit. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE promotions SET used_count = used_count + 1, updated_at = UTC_TIMESTAMP(6) "
        + "WHERE id = :id AND (usage_limit IS NULL OR used_count < usage_limit)", nativeQuery = true)
    int incrementUsage(@Param("id") Long id);

    @Query(value = "select promotion_id from promotion_redemptions where order_id = :orderId", nativeQuery = true)
    java.util.List<Long> redeemedPromotionIds(@Param("orderId") Long orderId);

    /** Returns 0 when the redemption is already gone (idempotent release). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "DELETE FROM promotion_redemptions WHERE promotion_id = :promotionId AND order_id = :orderId",
        nativeQuery = true)
    int deleteRedemption(@Param("promotionId") Long promotionId, @Param("orderId") Long orderId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE promotions SET used_count = GREATEST(used_count - 1, 0), updated_at = UTC_TIMESTAMP(6) "
        + "WHERE id = :id", nativeQuery = true)
    int decrementUsage(@Param("id") Long id);
}
