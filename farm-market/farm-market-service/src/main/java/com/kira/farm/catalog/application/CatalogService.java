package com.kira.farm.catalog.application;

import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductStatus;
import com.kira.farm.catalog.infrastructure.CategoryRepository;
import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

import static com.kira.farm.catalog.application.CatalogDtos.*;

/** Public (anonymous) storefront reads. Only ACTIVE products are visible. */
@Service
@RequiredArgsConstructor
public class CatalogService {
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final BranchRepository branches;
    private final InventoryService inventory;

    @Transactional(readOnly = true)
    public List<CategoryResponse> categories() {
        Map<Long, Long> counts = products.countByCategory(ProductStatus.ACTIVE).stream()
            .collect(Collectors.toMap(CategoryCount::categoryId, CategoryCount::count));
        return categories.findAllByOrderBySortOrderAscIdAsc().stream().map(c -> new CategoryResponse(c.getId(),
            c.getSlug(), c.getName(), counts.getOrDefault(c.getId(), 0L))).toList();
    }

    /** sort: popular (default) | newest | price_asc | price_desc | rating. */
    @Transactional(readOnly = true)
    public PageResponse<ProductSummary> search(String q, String category, Long branchId, Long minPrice, Long maxPrice,
                                               boolean inStock, String sort, int page, int size) {
        Map<Long, Branch> branchMap = branchMap();
        if (branchId != null && !branchMap.containsKey(branchId))
            throw ApiException.notFound("BRANCH_NOT_FOUND", "Không tìm thấy chi nhánh");
        Collection<Long> branchIds = branchId == null ? branchMap.keySet() : List.of(branchId);
        if (branchIds.isEmpty()) branchIds = List.of(-1L);
        long min = minPrice == null ? 0 : Math.max(0, minPrice);
        long max = maxPrice == null ? Long.MAX_VALUE : maxPrice;
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        String cat = category == null || category.isBlank() ? "%" : category.trim().toLowerCase(Locale.ROOT);
        var pageable = Paging.of(page, size, sortOf(sort));
        var result = products.searchPublic(branchIds, cat, like, min, max, inStock, pageable);
        Map<Long, Integer> stock = inventory.availableByProduct(
            result.getContent().stream().map(Product::getId).toList());
        return PageResponse.of(result, p -> summary(p, branchMap.get(p.getBranchId()), stock.getOrDefault(p.getId(), 0)));
    }

    @Transactional(readOnly = true)
    public ProductDetail detail(String slug) {
        Product p = products.findBySlug(slug).filter(x -> x.getStatus() == ProductStatus.ACTIVE)
            .orElseThrow(() -> ApiException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm"));
        Map<Long, Branch> branchMap = branchMap();
        List<Product> siblings = p.getGroupId() == null ? List.of()
            : products.findByGroupIdAndBranchIdNotAndStatusAndSuggestToOtherBranchesTrue(p.getGroupId(),
            p.getBranchId(), ProductStatus.ACTIVE);
        List<Long> ids = new ArrayList<>(siblings.stream().map(Product::getId).toList());
        ids.add(p.getId());
        Map<Long, Integer> stock = inventory.availableByProduct(ids);
        List<OtherBranchStock> others = siblings.stream().map(s -> {
            Branch b = branchMap.get(s.getBranchId());
            int avail = stock.getOrDefault(s.getId(), 0);
            return new OtherBranchStock(s.getBranchId(), b.getCode(), b.getName(), s.getId(), s.getSlug(),
                s.getPrice(), avail, avail > 0);
        }).sorted(Comparator.comparing(OtherBranchStock::branchId)).toList();
        Branch b = branchMap.get(p.getBranchId());
        return new ProductDetail(summary(p, b, stock.getOrDefault(p.getId(), 0)), p.getSku(), p.getDescription(),
            new BranchRef(b.getId(), b.getCode(), b.getName()), others);
    }

    static ProductSummary summary(Product p, Branch b, int available) {
        return new ProductSummary(p.getId(), p.getSlug(), p.getName(), p.getCategory().getSlug(),
            p.getCategory().getName(), p.getPrice(), p.getOldPrice(), p.getUnit(), p.getBadge(), p.getRatingAvg(),
            p.getReviewCount(), p.getOrigin(), p.getImageUrl(), p.getSoldCount(), b.getId(), b.getCode(), available,
            available > 0);
    }

    private Map<Long, Branch> branchMap() {
        return branches.findAllByOrderByIdAsc().stream()
            .collect(Collectors.toMap(Branch::getId, b -> b, (a, b) -> a, LinkedHashMap::new));
    }

    private static Sort sortOf(String sort) {
        String s = sort == null ? "popular" : sort;
        Sort tie = Sort.by(Sort.Direction.ASC, "id");
        return switch (s) {
            case "price_asc" -> Sort.by(Sort.Direction.ASC, "price").and(tie);
            case "price_desc" -> Sort.by(Sort.Direction.DESC, "price").and(tie);
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt").and(tie);
            case "rating" -> Sort.by(Sort.Direction.DESC, "ratingAvg").and(tie);
            case "popular" -> Sort.by(Sort.Direction.DESC, "soldCount").and(tie);
            default -> throw ApiException.badRequest("INVALID_PARAMETER", "Kiểu sắp xếp không hợp lệ");
        };
    }
}
