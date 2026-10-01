package com.kira.farm.account.application;

import com.kira.farm.account.domain.WishlistItem;
import com.kira.farm.account.infrastructure.WishlistRepository;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductStatus;
import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.farm.account.application.AccountDtos.*;

@Service
@RequiredArgsConstructor
public class WishlistService {
    private final WishlistRepository wishlist;
    private final ProductRepository products;
    private final BranchRepository branches;
    private final InventoryService inventory;

    /** branchId (optional) is the branch whose stock decides availability; defaults to each product's own branch. */
    @Transactional(readOnly = true)
    public List<WishlistEntry> list(Long branchId) {
        if (branchId != null && !branches.existsById(branchId))
            throw ApiException.badRequest("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại");
        List<WishlistItem> rows = wishlist.findByUserIdOrderByCreatedAtDesc(CurrentUser.id());
        Map<Long, Product> byId = products.findAllById(rows.stream().map(WishlistItem::getProductId).toList()).stream()
            .collect(Collectors.toMap(Product::getId, Function.identity()));
        List<WishlistEntry> result = new ArrayList<>();
        for (WishlistItem w : rows) {
            Product p = byId.get(w.getProductId());
            if (p == null) continue;
            result.add(new WishlistEntry(p.getId(), p.getSlug(), p.getName(), p.getImageUrl(), p.getUnit(), p.getPrice(),
                p.getBranchId(), p.getStatus(), w.getCreatedAt(), availability(p, branchId == null ? p.getBranchId() : branchId)));
        }
        return result;
    }

    @Transactional
    public void add(Long productId) {
        Product p = products.findById(productId)
            .filter(x -> x.getStatus() == ProductStatus.ACTIVE)
            .orElseThrow(() -> ApiException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm"));
        wishlist.add(CurrentUser.id(), p.getId());
    }

    @Transactional
    public void remove(Long productId) {
        wishlist.remove(CurrentUser.id(), productId);
    }

    private BranchAvailability availability(Product p, Long branchId) {
        Product local = p.getBranchId().equals(branchId) ? p : p.getGroupId() == null ? null
            : products.findFirstByGroupIdAndBranchIdAndStatus(p.getGroupId(), branchId, ProductStatus.ACTIVE).orElse(null);
        if (local == null) return null;
        int available = Math.max(0, inventory.available(branchId, local.getId()));
        return new BranchAvailability(branchId, local.getId(), local.getSlug(), local.getPrice(), available, available > 0);
    }
}
