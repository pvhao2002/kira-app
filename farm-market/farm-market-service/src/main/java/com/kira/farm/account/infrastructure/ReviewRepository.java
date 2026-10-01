package com.kira.farm.account.infrastructure;

import com.kira.farm.account.application.PendingReviewRow;
import com.kira.farm.account.domain.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    boolean existsByUserIdAndProductIdAndOrderId(Long userId, Long productId, Long orderId);

    Page<Review> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);

    Page<Review> findByProductIdOrderByIdDesc(Long productId, Pageable pageable);

    @Query("select new com.kira.farm.account.application.PendingReviewRow(o.id, o.code, p.id, p.name, p.slug, "
        + "p.imageUrl, o.updatedAt) from ShopOrder o, OrderItem i, Product p "
        + "where i.orderId = o.id and p.id = i.productId and o.userId = :userId "
        + "and o.status = com.kira.farm.order.domain.OrderStatus.DELIVERED "
        + "and not exists (select r.id from Review r where r.userId = o.userId and r.orderId = o.id "
        + "and r.productId = i.productId) order by o.updatedAt desc, i.id asc")
    List<PendingReviewRow> findPending(@Param("userId") Long userId);
}
