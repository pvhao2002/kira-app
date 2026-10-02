package com.kira.farm.account.application;

import com.kira.farm.account.domain.Review;
import com.kira.farm.account.infrastructure.ReviewRepository;
import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductStatus;
import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.identity.application.UserName;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.order.domain.ShopOrder;
import com.kira.farm.order.infrastructure.OrderItemRepository;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.farm.account.application.AccountDtos.*;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private final ReviewRepository reviews;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final ProductRepository products;
    private final UserRepository users;
    private final LoyaltyService loyalty;
    private final BranchAccess access;

    @Transactional(readOnly = true)
    public List<PendingReview> pending() {
        return reviews.findPending(CurrentUser.id()).stream().map(PendingReview::of).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<MyReview> mine(int page, int size) {
        var result = reviews.findByUserIdOrderByIdDesc(CurrentUser.id(), Paging.of(page, size));
        Map<Long, Product> byId = products.findAllById(result.getContent().stream().map(Review::getProductId).toList())
            .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        return PageResponse.of(result, r -> {
            Product p = byId.get(r.getProductId());
            int points = r.isHasPhoto() ? LoyaltyService.REVIEW_POINTS_PHOTO : LoyaltyService.REVIEW_POINTS_TEXT;
            return new MyReview(r.getId(), r.getOrderId(), r.getProductId(), p == null ? null : p.getName(),
                p == null ? null : p.getSlug(), r.getRating(), r.getBody(), r.getPhotoUrl(), points, r.getCreatedAt(),
                reply(r));
        });
    }

    /** Only for a DELIVERED order of the caller that contains the product, once per order item. +50 pts with photo, else +20. */
    @Transactional
    public MyReview create(ReviewRequest r) {
        Long userId = CurrentUser.id();
        ShopOrder order = orders.findByIdAndUserId(r.orderId(), userId)
            .orElseThrow(() -> ApiException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng"));
        if (order.getStatus() != OrderStatus.DELIVERED || !orderItems.existsByOrderIdAndProductId(order.getId(), r.productId()))
            throw ApiException.unprocessable("REVIEW_NOT_ALLOWED", "Chỉ có thể đánh giá sản phẩm của đơn hàng đã giao");
        if (reviews.existsByUserIdAndProductIdAndOrderId(userId, r.productId(), order.getId()))
            throw ApiException.conflict("REVIEW_EXISTS", "Bạn đã đánh giá sản phẩm này trong đơn hàng này");
        Product p = products.findById(r.productId()).orElseThrow(
            () -> ApiException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm"));

        boolean photo = r.photoUrl() != null && !r.photoUrl().isBlank();
        Review review = new Review();
        review.setUserId(userId);
        review.setProductId(p.getId());
        review.setOrderId(order.getId());
        review.setRating(r.rating());
        review.setBody(r.body() == null || r.body().isBlank() ? null : r.body().trim());
        review.setHasPhoto(photo);
        review.setPhotoUrl(photo ? r.photoUrl().trim() : null);
        review = reviews.saveAndFlush(review);
        products.refreshRating(p.getId());
        loyalty.awardReview(userId, review.getId(), photo);
        int points = photo ? LoyaltyService.REVIEW_POINTS_PHOTO : LoyaltyService.REVIEW_POINTS_TEXT;
        return new MyReview(review.getId(), review.getOrderId(), p.getId(), p.getName(), p.getSlug(), review.getRating(),
            review.getBody(), review.getPhotoUrl(), points, review.getCreatedAt(), null);
    }

    @Transactional(readOnly = true)
    public PageResponse<PublicReview> forProduct(String slug, int page, int size) {
        Product p = products.findBySlug(slug).filter(x -> x.getStatus() == ProductStatus.ACTIVE)
            .orElseThrow(() -> ApiException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm"));
        var result = reviews.findByProductIdOrderByIdDesc(p.getId(), Paging.of(page, size));
        Map<Long, String> names = users.findNames(result.getContent().stream().map(Review::getUserId).toList()).stream()
            .collect(Collectors.toMap(UserName::id, UserName::fullName));
        return PageResponse.of(result, r -> toPublic(r, names.get(r.getUserId())));
    }

    /** Branch reply to a review of a product in a branch the caller can access. */
    @Transactional
    public PublicReview reply(Long reviewId, ReplyRequest r) {
        Review review = reviews.findById(reviewId)
            .orElseThrow(() -> ApiException.notFound("REVIEW_NOT_FOUND", "Không tìm thấy đánh giá"));
        Product p = products.findById(review.getProductId()).orElseThrow();
        access.require(p.getBranchId());
        review.setReplyBody(r.body().trim());
        review.setReplyByUserId(CurrentUser.id());
        review.setRepliedAt(Instant.now());
        review = reviews.saveAndFlush(review);
        String author = users.findById(review.getUserId()).map(User::getFullName).orElse(null);
        return toPublic(review, author);
    }

    private static PublicReview toPublic(Review r, String fullName) {
        return new PublicReview(r.getId(), r.getRating(), r.getBody(), r.getPhotoUrl(), mask(fullName), r.getCreatedAt(),
            reply(r));
    }

    private static ReplyInfo reply(Review r) {
        return r.getReplyBody() == null ? null : new ReplyInfo(r.getReplyBody(), r.getRepliedAt());
    }

    /** "Nguyễn Văn An" -> "Nguyễn A." */
    static String mask(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Khách hàng";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }
}
