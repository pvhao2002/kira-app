package com.kira.farm.account.web;

import com.kira.farm.account.application.ReviewService;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.farm.account.application.AccountDtos.*;

@Tag(name = "Reviews")
@RestController
@RequiredArgsConstructor
public class ReviewController {
    private final ReviewService service;

    @GetMapping("/api/v1/reviews/pending")
    public List<PendingReview> pending() {
        return service.pending();
    }

    @GetMapping("/api/v1/reviews/mine")
    public PageResponse<MyReview> mine(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "10") int size) {
        return service.mine(page, size);
    }

    @PostMapping("/api/v1/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public MyReview create(@Valid @RequestBody ReviewRequest request) {
        return service.create(request);
    }

    /** Public (no login). */
    @GetMapping("/api/v1/products/{slug}/reviews")
    public PageResponse<PublicReview> forProduct(@PathVariable String slug,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return service.forProduct(slug, page, size);
    }

    @PostMapping("/api/v1/admin/reviews/{id}/reply")
    public PublicReview reply(@PathVariable Long id, @Valid @RequestBody ReplyRequest request) {
        return service.reply(id, request);
    }
}
