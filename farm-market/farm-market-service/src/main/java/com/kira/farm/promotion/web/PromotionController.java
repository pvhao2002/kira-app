package com.kira.farm.promotion.web;

import com.kira.farm.promotion.application.PromotionService;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static com.kira.farm.promotion.application.PromotionDtos.*;

@Tag(name = "Promotions")
@RestController
@RequiredArgsConstructor
public class PromotionController {
    private final PromotionService service;

    /** Checkout helper: authenticated customers check a code against their basket. Nothing is consumed. */
    @PostMapping("/api/v1/promotions/validate")
    public ValidateResponse validate(@Valid @RequestBody ValidateRequest r) {
        return service.evaluate(r.code(), CurrentUser.id(), r.branchId(), r.subtotal(), r.shippingFee());
    }

    @GetMapping("/api/v1/admin/promotions")
    public PageResponse<PromotionResponse> list(@RequestParam(required = false) String q,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return service.list(q, page, size);
    }

    @GetMapping("/api/v1/admin/promotions/{id}")
    public PromotionResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    @PostMapping("/api/v1/admin/promotions")
    @ResponseStatus(HttpStatus.CREATED)
    public PromotionResponse create(@Valid @RequestBody PromotionRequest request) {
        return service.create(request);
    }

    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    @PutMapping("/api/v1/admin/promotions/{id}")
    public PromotionResponse update(@PathVariable Long id, @Valid @RequestBody PromotionRequest request) {
        return service.update(id, request);
    }

    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    @DeleteMapping("/api/v1/admin/promotions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
