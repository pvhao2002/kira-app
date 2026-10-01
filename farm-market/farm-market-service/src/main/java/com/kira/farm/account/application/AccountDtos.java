package com.kira.farm.account.application;

import com.kira.farm.account.domain.Address;
import com.kira.farm.catalog.domain.ProductStatus;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AccountDtos {
    private AccountDtos() {
    }

    // ---- Addresses ------------------------------------------------------------------------------------------

    /**
     * nearestBranchId is optional: when sent it must exist, otherwise the server picks the branch whose address
     * matches the district (then city), or leaves it empty.
     */
    public record AddressRequest(
        @NotBlank @Size(max = 40) String label,
        @NotBlank @Size(max = 120) String recipient,
        @NotBlank @Pattern(regexp = "^[0-9+()\\s.-]{8,20}$", message = "Số điện thoại không hợp lệ") String phone,
        @NotBlank @Size(max = 255) String line1,
        @Size(max = 80) String ward,
        @Size(max = 80) String district,
        @Size(max = 80) String city,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        Long nearestBranchId,
        boolean makeDefault) {
    }

    public record AddressResponse(Long id, String label, String recipient, String phone, String line1, String ward,
                                  String district, String city, BigDecimal latitude, BigDecimal longitude,
                                  Long nearestBranchId, boolean isDefault) {
        public static AddressResponse of(Address a) {
            return new AddressResponse(a.getId(), a.getLabel(), a.getRecipient(), a.getPhone(), a.getLine1(),
                a.getWard(), a.getDistrict(), a.getCity(), a.getLatitude(), a.getLongitude(), a.getNearestBranchId(),
                a.isDefaultAddress());
        }
    }

    // ---- Wishlist -------------------------------------------------------------------------------------------

    /** The product as sold in the requested branch (the same product, or its group equivalent). */
    public record BranchAvailability(Long branchId, Long productId, String slug, long price, int available,
                                     boolean inStock) {
    }

    /** availability is null when the requested branch does not sell this product. */
    public record WishlistEntry(Long productId, String slug, String name, String imageUrl, String unit, long price,
                                Long productBranchId, ProductStatus status, Instant addedAt,
                                BranchAvailability availability) {
    }

    // ---- Reviews --------------------------------------------------------------------------------------------

    public record ReviewRequest(
        @NotNull Long orderId,
        @NotNull Long productId,
        @Min(1) @Max(5) int rating,
        @Size(max = 2000) String body,
        @Pattern(regexp = "^https://\\S{1,490}$", message = "Liên kết ảnh phải bắt đầu bằng https://") String photoUrl) {
    }

    public record ReplyRequest(@NotBlank(message = "Vui lòng nhập phản hồi") @Size(max = 2000) String body) {
    }

    public record ReplyInfo(String body, Instant repliedAt) {
    }

    public record PendingReview(Long orderId, String orderCode, Long productId, String productName, String slug,
                                String imageUrl, Instant deliveredAt) {
        public static PendingReview of(PendingReviewRow r) {
            return new PendingReview(r.orderId(), r.orderCode(), r.productId(), r.productName(), r.slug(),
                r.imageUrl(), r.deliveredAt());
        }
    }

    /** A customer's own review (with the product it is about). */
    public record MyReview(Long id, Long orderId, Long productId, String productName, String slug, int rating,
                           String body, String photoUrl, int pointsAwarded, Instant createdAt, ReplyInfo reply) {
    }

    /** Public view: the author is shown as first name + initial only. */
    public record PublicReview(Long id, int rating, String body, String photoUrl, String author, Instant createdAt,
                               ReplyInfo reply) {
    }
}
