package com.kira.farm.catalog.infrastructure;

import com.kira.farm.catalog.application.CategoryCount;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @EntityGraph(attributePaths = "category")
    Optional<Product> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Equivalent products of the given groups sold in one branch (wishlist availability), lowest id first. */
    List<Product> findByGroupIdInAndBranchIdAndStatusOrderByIdAsc(Collection<Long> groupIds, Long branchId,
                                                                  ProductStatus status);

    @Modifying
    @Query(value = "UPDATE products SET sold_count = sold_count + :qty WHERE id = :id", nativeQuery = true)
    int incrementSold(@Param("id") Long id, @Param("qty") int qty);

    /** Recomputes review_count / rating_avg from the reviews table. */
    @Modifying
    @Query(value = "UPDATE products p SET p.review_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id), "
        + "p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.product_id = p.id), 0) "
        + "WHERE p.id = :id", nativeQuery = true)
    int refreshRating(@Param("id") Long id);

    boolean existsByBranchIdAndSku(Long branchId, String sku);

    @Query("select new com.kira.farm.catalog.application.CategoryCount(p.category.id, count(p)) from Product p "
        + "where p.status = :status group by p.category.id")
    List<CategoryCount> countByCategory(@Param("status") ProductStatus status);

    List<Product> findByGroupIdAndBranchIdNotAndStatusAndSuggestToOtherBranchesTrue(Long groupId, Long branchId,
                                                                                    ProductStatus status);

    /** Storefront search. q is a lower-cased LIKE pattern, category a slug LIKE pattern ('%' = any). */
    @EntityGraph(attributePaths = "category")
    @Query("select p from Product p where p.status = com.kira.farm.catalog.domain.ProductStatus.ACTIVE "
        + "and p.branchId in :branchIds and p.category.slug like :category and lower(p.name) like :q "
        + "and p.price >= :minPrice and p.price <= :maxPrice "
        + "and (:inStock = false or exists (select 1 from InventoryItem i where i.productId = p.id "
        + "and i.onHand - i.reserved > 0))")
    Page<Product> searchPublic(@Param("branchIds") Collection<Long> branchIds, @Param("category") String category,
                               @Param("q") String q, @Param("minPrice") long minPrice,
                               @Param("maxPrice") long maxPrice, @Param("inStock") boolean inStock,
                               Pageable pageable);

    @EntityGraph(attributePaths = "category")
    @Query("select p from Product p where p.branchId in :branchIds and p.status in :statuses "
        + "and (lower(p.name) like :q or lower(p.sku) like :q)")
    Page<Product> searchAdmin(@Param("branchIds") Collection<Long> branchIds,
                              @Param("statuses") Collection<ProductStatus> statuses, @Param("q") String q,
                              Pageable pageable);
}
