package com.kira.farm.inventory.application;

import com.kira.farm.inventory.domain.InventoryMovement;
import com.kira.farm.inventory.domain.MovementType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class InventoryDtos {
    private InventoryDtos() {
    }

    public record StockResponse(Long productId, String sku, String name, String unit, Long branchId, int onHand,
                                int reserved, int available, String level) {
        public static StockResponse of(InventoryRow r) {
            return new StockResponse(r.productId(), r.sku(), r.name(), r.unit(), r.branchId(), r.onHand(),
                r.reserved(), r.available(), r.level());
        }
    }

    public record ReceiptLine(@NotNull Long productId, @Min(1) @Max(1_000_000) int quantity) {
    }

    /** Goods-in receipt (phiếu nhập kho) for one branch. */
    public record ReceiptRequest(@NotNull Long branchId, @NotEmpty @Size(max = 200) List<@Valid ReceiptLine> lines,
                                 @Size(max = 255) String note) {
    }

    /** Signed stock correction (kiểm kho): delta may be negative but never below the reserved quantity. */
    public record AdjustmentRequest(@NotNull Long branchId, @NotNull Long productId,
                                    @Min(-1_000_000) @Max(1_000_000) int delta,
                                    @NotBlank(message = "Vui lòng nhập lý do") @Size(max = 255) String reason) {
    }

    public record MovementResponse(Long id, Long branchId, Long productId, MovementType type, int delta,
                                   int onHandAfter, String reason, String refType, String refId, Long actorUserId,
                                   Instant createdAt) {
        public static MovementResponse of(InventoryMovement m) {
            return new MovementResponse(m.getId(), m.getBranchId(), m.getProductId(), m.getType(), m.getDelta(),
                m.getOnHandAfter(), m.getReason(), m.getRefType(), m.getRefId(), m.getActorUserId(), m.getCreatedAt());
        }
    }
}
