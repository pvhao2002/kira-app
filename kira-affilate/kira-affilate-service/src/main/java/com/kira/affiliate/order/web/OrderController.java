package com.kira.affiliate.order.web;

import com.kira.affiliate.order.application.OrderQueryService;
import com.kira.affiliate.order.application.OrderQueryService.Filter;
import com.kira.affiliate.order.application.OrderQueryService.OrderDetail;
import com.kira.affiliate.order.application.OrderQueryService.OrderRow;
import com.kira.affiliate.order.application.OrderQueryService.ValidationView;
import com.kira.affiliate.order.application.SyncService;
import com.kira.affiliate.order.application.SyncService.RunView;
import com.kira.affiliate.order.application.SyncService.StatusView;
import com.kira.affiliate.shared.web.ApiTypes.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class OrderController {
    private static final String BUCKETS = "ESTIMATED|CONFIRMED|REJECTED|VALIDATED|";
    private final OrderQueryService orders;
    private final SyncService sync;

    public record ValidationRequest(@NotNull @Positive Long validationId) {
    }

    @GetMapping("/orders")
    public PageResponse<OrderRow> list(@AuthenticationPrincipal Long userId,
                                       @RequestParam(required = false) @Size(max = 200) String search,
                                       @RequestParam(required = false) @Size(max = 30) String orderStatus,
                                       @RequestParam(required = false) @Pattern(regexp = BUCKETS) String bucket,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                       @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                       @RequestParam(defaultValue = "purchaseTime,desc") @Size(max = 40) String sort) {
        return orders.list(userId, new Filter(search, orderStatus, bucket, from, to), page, size, sort);
    }

    @GetMapping("/orders/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Long userId,
                                         @RequestParam(required = false) @Size(max = 200) String search,
                                         @RequestParam(required = false) @Size(max = 30) String orderStatus,
                                         @RequestParam(required = false) @Pattern(regexp = BUCKETS) String bucket,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return orders.export(userId, new Filter(search, orderStatus, bucket, from, to)).download("don-hang-hoa-hong.csv");
    }

    @GetMapping("/orders/{id}")
    public OrderDetail detail(@AuthenticationPrincipal Long userId, @PathVariable long id) {
        return orders.detail(userId, id);
    }

    @PostMapping("/sync")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public RunView sync(@AuthenticationPrincipal Long userId) {
        return sync.start(userId, SyncService.CONVERSIONS, "MANUAL", null);
    }

    @GetMapping("/sync/status")
    public StatusView status(@AuthenticationPrincipal Long userId) {
        return sync.status(userId);
    }

    @GetMapping("/sync/runs")
    public PageResponse<RunView> runs(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size) {
        return sync.history(userId, page, size);
    }

    @PostMapping("/validations")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public RunView importValidation(@AuthenticationPrincipal Long userId, @Valid @RequestBody ValidationRequest request) {
        return sync.start(userId, SyncService.VALIDATION, "MANUAL", request.validationId());
    }

    @GetMapping("/validations")
    public List<ValidationView> validations(@AuthenticationPrincipal Long userId) {
        return orders.validations(userId);
    }
}
