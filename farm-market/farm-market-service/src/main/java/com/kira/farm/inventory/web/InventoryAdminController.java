package com.kira.farm.inventory.web;

import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import static com.kira.farm.inventory.application.InventoryDtos.*;

@Tag(name = "Admin inventory")
@RestController
@RequestMapping("/api/v1/admin/inventory")
@RequiredArgsConstructor
public class InventoryAdminController {
    private final InventoryService service;

    /** level: OUT | LOW (&lt; 10 available) | OK. */
    @GetMapping
    public PageResponse<StockResponse> list(@RequestParam(required = false) Long branchId,
                                            @RequestParam(required = false) String q,
                                            @RequestParam(required = false) String level,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return service.list(branchId, q, level, page, size);
    }

    @PostMapping("/receipts")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void receive(@Valid @RequestBody ReceiptRequest request) {
        service.receive(request);
    }

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adjust(@Valid @RequestBody AdjustmentRequest request) {
        service.adjust(request);
    }

    @GetMapping("/movements")
    public PageResponse<MovementResponse> movements(@RequestParam(required = false) Long branchId,
                                                    @RequestParam(required = false) Long productId,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return service.movements(branchId, productId, page, size);
    }
}
