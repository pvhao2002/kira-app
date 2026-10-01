package com.kira.farm.catalog.application;

import com.kira.farm.catalog.domain.ProductStatus;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CatalogDtos {
    private CatalogDtos() {
    }

    public record CategoryResponse(Long id, String slug, String name, long count) {
    }

    /** Storefront card. Mirrors the UI Product model (category, oldPrice, rating, reviews, sold, inStock). */
    public record ProductSummary(Long id, String slug, String name, String category, String categoryName,
                                 long price, Long oldPrice, String unit, String badge, BigDecimal rating,
                                 int reviews, String origin, String imageUrl, int sold, Long branchId,
                                 String branchCode, int available, boolean inStock) {
    }

    public record BranchRef(Long id, String code, String name) {
    }

    /** Same item in another branch of the group, shown only when that branch opted in (suggest_to_other_branches). */
    public record OtherBranchStock(Long branchId, String branchCode, String branchName, Long productId, String slug,
                                   long price, int available, boolean inStock) {
    }

    public record ProductDetail(ProductSummary product, String sku, String description, BranchRef branch,
                                List<OtherBranchStock> otherBranches) {
    }

    public record AdminProductResponse(Long id, Long branchId, Long groupId, String groupName, String category,
                                       String sku, String name, String slug, String description, String origin,
                                       String imageUrl, String badge, long price, Long oldPrice, String unit,
                                       ProductStatus status, boolean suggestToOtherBranches, int onHand,
                                       int reserved, int available, Instant updatedAt) {
    }

    /** Create/update body. branchId and initialStock are only used on create; the branch never changes. */
    public record ProductRequest(
        Long branchId,
        @NotBlank(message = "Vui lòng nhập SKU") @Size(max = 40) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "SKU chỉ gồm chữ, số, . _ -") String sku,
        @NotBlank(message = "Vui lòng nhập tên sản phẩm") @Size(max = 200) String name,
        @Size(max = 220) @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$", message = "Slug không hợp lệ") String slug,
        @NotBlank(message = "Vui lòng chọn danh mục") String category,
        @Size(max = 160) String groupName,
        @Size(max = 5000) String description,
        @Size(max = 160) String origin,
        @Size(max = 500) String imageUrl,
        @Size(max = 40) String badge,
        @Min(value = 0, message = "Giá không hợp lệ") @Max(1_000_000_000L) long price,
        @Min(0) @Max(1_000_000_000L) Long oldPrice,
        @NotBlank(message = "Vui lòng nhập đơn vị") @Size(max = 20) String unit,
        ProductStatus status,
        Boolean suggestToOtherBranches,
        @Min(0) @Max(1_000_000) Integer initialStock) {
    }
}
