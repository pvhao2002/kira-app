package com.kira.farm.order.web;

import com.kira.farm.order.application.OrderService;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.IdempotencyKey;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import static com.kira.farm.order.application.OrderDtos.*;

@Tag(name = "Orders")
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService service;

    @Operation(summary = "Checkout; requires Idempotency-Key. A retry with the same key returns the original order")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse checkout(@RequestHeader(value = IdempotencyKey.HEADER, required = false) String idempotencyKey,
                                  @Valid @RequestBody CheckoutRequest request) {
        return service.checkout(idempotencyKey, request);
    }

    @GetMapping
    public PageResponse<OrderSummary> list(@RequestParam(required = false) OrderStatus status,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "10") int size) {
        return service.list(status, page, size);
    }

    @GetMapping("/{code}")
    public OrderResponse get(@PathVariable String code) {
        return service.get(code);
    }

    @PostMapping("/{code}/cancel")
    public OrderResponse cancel(@PathVariable String code) {
        return service.cancel(code);
    }

    @PostMapping("/{code}/reorder")
    public ReorderResponse reorder(@PathVariable String code) {
        return service.reorder(code);
    }
}
