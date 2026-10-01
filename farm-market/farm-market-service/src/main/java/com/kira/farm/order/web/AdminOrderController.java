package com.kira.farm.order.web;

import com.kira.farm.order.application.AdminOrderService;
import com.kira.farm.order.domain.OrderStatus;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

import static com.kira.farm.order.application.OrderDtos.*;

@Tag(name = "Admin orders")
@RestController
@RequestMapping("/api/v1/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {
    private final AdminOrderService service;

    /** from/to are inclusive dates (yyyy-MM-dd, Vietnam time). q matches code, recipient or phone. */
    @GetMapping
    public AdminOrderList list(@RequestParam(required = false) OrderStatus status,
                               @RequestParam(required = false) String q,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                               @RequestParam(required = false) Long branchId,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size) {
        return service.list(status, q, from, to, branchId, page, size);
    }

    @GetMapping("/{code}")
    public AdminOrderDetail get(@PathVariable String code) {
        return service.get(code);
    }

    @PostMapping("/{code}/status")
    public AdminOrderDetail changeStatus(@PathVariable String code, @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(code, request);
    }

    @PostMapping("/{code}/payment")
    public AdminOrderDetail setPayment(@PathVariable String code, @Valid @RequestBody PaymentRequest request) {
        return service.setPayment(code, request);
    }

    @PostMapping("/{code}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse addNote(@PathVariable String code, @Valid @RequestBody NoteRequest request) {
        return service.addNote(code, request);
    }
}
