package com.kira.farm.catalog.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.catalog.domain.Category;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductGroup;
import com.kira.farm.catalog.domain.ProductStatus;
import com.kira.farm.catalog.infrastructure.CategoryRepository;
import com.kira.farm.catalog.infrastructure.ProductGroupRepository;
import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.inventory.domain.InventoryItem;
import com.kira.farm.inventory.infrastructure.InventoryRepository;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.farm.catalog.application.CatalogDtos.*;

/** Back-office product CRUD, always scoped to the branches the caller can access. */
@Service
@RequiredArgsConstructor
public class AdminProductService {
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final ProductGroupRepository groups;
    private final BranchRepository branches;
    private final InventoryRepository inventoryRepo;
    private final InventoryService inventory;
    private final BranchAccess access;

    @Transactional(readOnly = true)
    public PageResponse<AdminProductResponse> list(Long branchId, String q, ProductStatus status, int page, int size) {
        Set<Long> scope = access.scope(branchId);
        Collection<ProductStatus> statuses = status == null ? List.of(ProductStatus.values()) : List.of(status);
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        var result = products.searchAdmin(scope, statuses, like,
            Paging.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        Map<Long, InventoryItem> stock = inventoryRepo.findByProductIdIn(
            result.getContent().stream().map(Product::getId).toList()).stream()
            .collect(Collectors.toMap(InventoryItem::getProductId, Function.identity()));
        Map<Long, String> groupNames = groupNames(result.getContent());
        return PageResponse.of(result, p -> toResponse(p, stock.get(p.getId()), groupNames.get(p.getGroupId())));
    }

    @Transactional(readOnly = true)
    public AdminProductResponse get(Long id) {
        Product p = requireAccessible(id);
        return toResponse(p, inventoryRepo.findByBranchIdAndProductId(p.getBranchId(), p.getId()).orElse(null),
            groupNames(List.of(p)).get(p.getGroupId()));
    }

    @Transactional
    public AdminProductResponse create(ProductRequest r) {
        if (r.branchId() == null)
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ", Map.of("branchId", "Vui lòng chọn chi nhánh"));
        access.require(r.branchId());
        Branch branch = branches.findById(r.branchId()).orElseThrow();
        String sku = r.sku().trim();
        if (products.existsByBranchIdAndSku(branch.getId(), sku))
            throw ApiException.conflict("SKU_EXISTS", "SKU đã tồn tại tại chi nhánh này");
        Product p = new Product();
        p.setBranchId(branch.getId());
        p.setSlug(r.slug() != null && !r.slug().isBlank() ? explicitSlug(r.slug()) : uniqueSlug(r.name(), branch));
        apply(p, r);
        p.setSku(sku);
        p = products.saveAndFlush(p);
        inventory.createRow(branch.getId(), p.getId(), r.initialStock() == null ? 0 : r.initialStock());
        return get(p.getId());
    }

    @Transactional
    public AdminProductResponse update(Long id, ProductRequest r) {
        Product p = requireAccessible(id);
        String sku = r.sku().trim();
        if (!sku.equals(p.getSku()) && products.existsByBranchIdAndSku(p.getBranchId(), sku))
            throw ApiException.conflict("SKU_EXISTS", "SKU đã tồn tại tại chi nhánh này");
        if (r.slug() != null && !r.slug().isBlank() && !r.slug().equals(p.getSlug())) p.setSlug(explicitSlug(r.slug()));
        apply(p, r);
        p.setSku(sku);
        products.saveAndFlush(p);
        return get(id);
    }

    /** Soft delete: orders keep referencing the product, so it is hidden instead of removed. */
    @Transactional
    public void hide(Long id) {
        requireAccessible(id).setStatus(ProductStatus.HIDDEN);
    }

    private void apply(Product p, ProductRequest r) {
        if (r.oldPrice() != null && r.oldPrice() <= r.price())
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ", Map.of("oldPrice", "Giá gốc phải lớn hơn giá bán"));
        Category category = categories.findBySlug(r.category().trim().toLowerCase(Locale.ROOT)).orElseThrow(
            () -> ApiException.badRequest("CATEGORY_NOT_FOUND", "Danh mục không tồn tại"));
        p.setCategory(category);
        p.setName(r.name().trim());
        p.setDescription(r.description());
        p.setOrigin(r.origin());
        p.setImageUrl(r.imageUrl());
        p.setBadge(r.badge() == null || r.badge().isBlank() ? null : r.badge().trim());
        p.setPrice(r.price());
        p.setOldPrice(r.oldPrice());
        p.setUnit(r.unit().trim());
        if (r.status() != null) p.setStatus(r.status());
        if (r.suggestToOtherBranches() != null) p.setSuggestToOtherBranches(r.suggestToOtherBranches());
        if (r.groupName() != null) {
            p.setGroupId(r.groupName().isBlank() ? null : findOrCreateGroup(r.groupName().trim()).getId());
        }
    }

    private ProductGroup findOrCreateGroup(String name) {
        String code = Slugs.slugify(name);
        return groups.findByCode(code).orElseGet(() -> {
            ProductGroup g = new ProductGroup();
            g.setCode(code);
            g.setName(name);
            return groups.save(g);
        });
    }

    private String explicitSlug(String slug) {
        if (products.existsBySlug(slug)) throw ApiException.conflict("SLUG_EXISTS", "Slug đã tồn tại");
        return slug;
    }

    private String uniqueSlug(String name, Branch branch) {
        String base = Slugs.slugify(name);
        String slug = base;
        if (products.existsBySlug(slug)) slug = base + "-" + branch.getCode().toLowerCase(Locale.ROOT);
        for (int i = 2; products.existsBySlug(slug); i++)
            slug = base + "-" + branch.getCode().toLowerCase(Locale.ROOT) + "-" + i;
        return slug;
    }

    private Product requireAccessible(Long id) {
        Product p = products.findById(id).orElseThrow(
            () -> ApiException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm"));
        access.require(p.getBranchId());
        return p;
    }

    private Map<Long, String> groupNames(List<Product> list) {
        Set<Long> ids = list.stream().map(Product::getGroupId).filter(Objects::nonNull).collect(Collectors.toSet());
        return groups.findAllById(ids).stream().collect(Collectors.toMap(ProductGroup::getId, ProductGroup::getName));
    }

    private static AdminProductResponse toResponse(Product p, InventoryItem i, String groupName) {
        int onHand = i == null ? 0 : i.getOnHand();
        int reserved = i == null ? 0 : i.getReserved();
        return new AdminProductResponse(p.getId(), p.getBranchId(), p.getGroupId(), groupName,
            p.getCategory().getSlug(), p.getSku(), p.getName(), p.getSlug(), p.getDescription(), p.getOrigin(),
            p.getImageUrl(), p.getBadge(), p.getPrice(), p.getOldPrice(), p.getUnit(), p.getStatus(),
            p.isSuggestToOtherBranches(), onHand, reserved, onHand - reserved, p.getUpdatedAt());
    }
}
