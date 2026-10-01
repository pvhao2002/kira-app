package com.kira.farm.inventory.infrastructure;

import com.kira.farm.inventory.application.InventoryRow;
import com.kira.farm.inventory.domain.InventoryItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByBranchIdAndProductId(Long branchId, Long productId);

    List<InventoryItem> findByProductIdIn(Collection<Long> productIds);

    /** Atomic: succeeds only if enough is available (on_hand - reserved >= qty). Returns affected rows (0 or 1). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE inventory SET reserved = reserved + :qty, updated_at = UTC_TIMESTAMP(6) "
        + "WHERE branch_id = :branchId AND product_id = :productId AND on_hand - reserved >= :qty", nativeQuery = true)
    int reserve(@Param("branchId") Long branchId, @Param("productId") Long productId, @Param("qty") int qty);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE inventory SET reserved = reserved - :qty, updated_at = UTC_TIMESTAMP(6) "
        + "WHERE branch_id = :branchId AND product_id = :productId AND reserved >= :qty", nativeQuery = true)
    int release(@Param("branchId") Long branchId, @Param("productId") Long productId, @Param("qty") int qty);

    /** Turns a reservation into a sale: removes qty from both on_hand and reserved. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE inventory SET on_hand = on_hand - :qty, reserved = reserved - :qty, "
        + "updated_at = UTC_TIMESTAMP(6) "
        + "WHERE branch_id = :branchId AND product_id = :productId AND reserved >= :qty", nativeQuery = true)
    int commit(@Param("branchId") Long branchId, @Param("productId") Long productId, @Param("qty") int qty);

    /** Adds delta (positive or negative) to on_hand; refuses to go below the reserved quantity. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE inventory SET on_hand = on_hand + :delta, updated_at = UTC_TIMESTAMP(6) "
        + "WHERE branch_id = :branchId AND product_id = :productId AND on_hand + :delta >= reserved", nativeQuery = true)
    int addOnHand(@Param("branchId") Long branchId, @Param("productId") Long productId, @Param("delta") int delta);

    @Query(value = "select new com.kira.farm.inventory.application.InventoryRow(p.id, p.sku, p.name, p.unit, "
        + "i.branchId, i.onHand, i.reserved) from InventoryItem i, Product p "
        + "where i.productId = p.id and i.branchId in :branchIds "
        + "and (lower(p.name) like :q or lower(p.sku) like :q) "
        + "and (i.onHand - i.reserved) between :minAvailable and :maxAvailable order by p.name asc, p.id asc",
        countQuery = "select count(i) from InventoryItem i, Product p "
            + "where i.productId = p.id and i.branchId in :branchIds "
            + "and (lower(p.name) like :q or lower(p.sku) like :q) "
            + "and (i.onHand - i.reserved) between :minAvailable and :maxAvailable")
    Page<InventoryRow> search(@Param("branchIds") Collection<Long> branchIds, @Param("q") String q,
                              @Param("minAvailable") int minAvailable, @Param("maxAvailable") int maxAvailable,
                              Pageable pageable);
}
