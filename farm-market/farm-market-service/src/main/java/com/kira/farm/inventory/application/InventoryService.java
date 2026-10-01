package com.kira.farm.inventory.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.inventory.domain.InventoryItem;
import com.kira.farm.inventory.domain.InventoryMovement;
import com.kira.farm.inventory.domain.MovementType;
import com.kira.farm.inventory.infrastructure.InventoryMovementRepository;
import com.kira.farm.inventory.infrastructure.InventoryRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.kira.farm.inventory.application.InventoryDtos.*;

/**
 * Stock rules. reserve/release/commit/returnToStock are the ONLY way orders touch stock; each is one conditional
 * UPDATE so concurrent checkouts cannot oversell a branch. Call them inside the order transaction so a failure
 * rolls back every earlier line of the same order.
 */
@Service
@RequiredArgsConstructor
public class InventoryService {
    private final InventoryRepository inventory;
    private final InventoryMovementRepository movements;
    private final BranchAccess access;

    // ---- API for the order capability -------------------------------------------------------------------------

    /** Holds qty for a pending order. Throws 409 INSUFFICIENT_STOCK if the branch cannot cover it. */
    @Transactional
    public void reserve(Long branchId, Long productId, int qty) {
        requirePositive(qty);
        if (inventory.reserve(branchId, productId, qty) == 0) throw shortage(branchId, productId);
    }

    /** Returns a reservation (order cancelled/expired before shipping). */
    @Transactional
    public void release(Long branchId, Long productId, int qty) {
        requirePositive(qty);
        if (inventory.release(branchId, productId, qty) == 0)
            throw ApiException.conflict("RESERVATION_NOT_FOUND", "Không có hàng đang giữ để hoàn trả");
    }

    /** Converts a reservation into a sale (on_hand and reserved both drop) and logs a SALE movement. */
    @Transactional
    public void commit(Long branchId, Long productId, int qty, String refType, String refId) {
        requirePositive(qty);
        if (inventory.commit(branchId, productId, qty) == 0)
            throw ApiException.conflict("RESERVATION_NOT_FOUND", "Không có hàng đang giữ để xuất kho");
        log(branchId, productId, MovementType.SALE, -qty, "Bán hàng", refType, refId, actorOrNull());
    }

    /** Puts goods back on the shelf after a committed sale is cancelled/returned. */
    @Transactional
    public void returnToStock(Long branchId, Long productId, int qty, String refType, String refId) {
        requirePositive(qty);
        if (inventory.addOnHand(branchId, productId, qty) == 0) throw missing();
        log(branchId, productId, MovementType.RETURN, qty, "Hoàn kho", refType, refId, actorOrNull());
    }

    @Transactional(readOnly = true)
    public int available(Long branchId, Long productId) {
        return inventory.findByBranchIdAndProductId(branchId, productId).map(InventoryItem::available).orElse(0);
    }

    /** productId -> available (missing rows are absent from the map; treat as 0). */
    @Transactional(readOnly = true)
    public Map<Long, Integer> availableByProduct(Collection<Long> productIds) {
        Map<Long, Integer> result = new HashMap<>();
        if (productIds.isEmpty()) return result;
        inventory.findByProductIdIn(productIds).forEach(i -> result.put(i.getProductId(), i.available()));
        return result;
    }

    /** Creates the stock row for a new product (called by catalog). Initial stock is logged as a RECEIPT. */
    @Transactional
    public void createRow(Long branchId, Long productId, int initialQuantity) {
        InventoryItem item = new InventoryItem();
        item.setBranchId(branchId);
        item.setProductId(productId);
        item.setOnHand(Math.max(0, initialQuantity));
        inventory.saveAndFlush(item);
        if (initialQuantity > 0)
            log(branchId, productId, MovementType.RECEIPT, initialQuantity, "Tồn đầu kỳ", null, null, actorOrNull());
    }

    // ---- Admin operations ---------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<StockResponse> list(Long branchId, String q, String level, int page, int size) {
        Set<Long> branchIds = access.scope(branchId);
        int min = Integer.MIN_VALUE;
        int max = Integer.MAX_VALUE;
        if (level != null && !level.isBlank()) {
            switch (level.toUpperCase(Locale.ROOT)) {
                case "OUT" -> max = 0;
                case "LOW" -> {
                    min = 1;
                    max = InventoryRow.LOW_STOCK_LIMIT - 1;
                }
                case "OK" -> min = InventoryRow.LOW_STOCK_LIMIT;
                default -> throw ApiException.badRequest("INVALID_PARAMETER", "Mức tồn không hợp lệ");
            }
        }
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        return PageResponse.of(inventory.search(branchIds, like, min, max, Paging.of(page, size)), StockResponse::of);
    }

    /** Goods-in receipt: adds stock for each line and appends a RECEIPT movement per line. */
    @Transactional
    public void receive(ReceiptRequest request) {
        access.require(request.branchId());
        for (ReceiptLine line : request.lines()) {
            if (inventory.addOnHand(request.branchId(), line.productId(), line.quantity()) == 0) throw missing();
            log(request.branchId(), line.productId(), MovementType.RECEIPT, line.quantity(), request.note(), null,
                null, CurrentUser.id());
        }
    }

    @Transactional
    public void adjust(AdjustmentRequest request) {
        access.require(request.branchId());
        if (request.delta() == 0) throw ApiException.badRequest("INVALID_PARAMETER", "Số lượng điều chỉnh phải khác 0");
        if (inventory.addOnHand(request.branchId(), request.productId(), request.delta()) == 0) {
            if (inventory.findByBranchIdAndProductId(request.branchId(), request.productId()).isEmpty()) throw missing();
            throw ApiException.conflict("STOCK_BELOW_RESERVED", "Tồn kho không thể thấp hơn số lượng đang giữ");
        }
        log(request.branchId(), request.productId(), MovementType.ADJUSTMENT, request.delta(), request.reason(),
            null, null, CurrentUser.id());
    }

    @Transactional(readOnly = true)
    public PageResponse<MovementResponse> movements(Long branchId, Long productId, int page, int size) {
        Set<Long> branchIds = access.scope(branchId);
        var pageable = Paging.of(page, size);
        var result = productId == null ? movements.findByBranchIdInOrderByIdDesc(branchIds, pageable)
            : movements.findByBranchIdInAndProductIdOrderByIdDesc(branchIds, productId, pageable);
        return PageResponse.of(result, MovementResponse::of);
    }

    // ---- internals ----------------------------------------------------------------------------------------------

    private void log(Long branchId, Long productId, MovementType type, int delta, String reason, String refType,
                     String refId, Long actor) {
        // The preceding UPDATE holds the row lock, so this read sees the post-change value of this transaction.
        int after = inventory.findByBranchIdAndProductId(branchId, productId).map(InventoryItem::getOnHand).orElse(0);
        InventoryMovement m = new InventoryMovement();
        m.setBranchId(branchId);
        m.setProductId(productId);
        m.setType(type);
        m.setDelta(delta);
        m.setOnHandAfter(after);
        m.setReason(reason);
        m.setRefType(refType);
        m.setRefId(refId);
        m.setActorUserId(actor);
        movements.save(m);
    }

    private static Long actorOrNull() {
        return CurrentUser.find().map(p -> p.userId()).orElse(null);
    }

    private static void requirePositive(int qty) {
        if (qty <= 0) throw ApiException.badRequest("INVALID_QUANTITY", "Số lượng phải lớn hơn 0");
    }

    private ApiException shortage(Long branchId, Long productId) {
        if (inventory.findByBranchIdAndProductId(branchId, productId).isEmpty()) return missing();
        return ApiException.conflict("INSUFFICIENT_STOCK", "Không đủ hàng trong kho chi nhánh");
    }

    private static ApiException missing() {
        return ApiException.notFound("INVENTORY_NOT_FOUND", "Sản phẩm chưa có tồn kho tại chi nhánh này");
    }
}
