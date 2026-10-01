package com.kira.farm.account.infrastructure;

import com.kira.farm.account.domain.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WishlistRepository extends JpaRepository<WishlistItem, WishlistItem.Key> {
    List<WishlistItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Idempotent add. */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT IGNORE INTO wishlist_items (user_id, product_id, created_at) "
        + "VALUES (:userId, :productId, UTC_TIMESTAMP(6))", nativeQuery = true)
    int add(@Param("userId") Long userId, @Param("productId") Long productId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "DELETE FROM wishlist_items WHERE user_id = :userId AND product_id = :productId", nativeQuery = true)
    int remove(@Param("userId") Long userId, @Param("productId") Long productId);
}
