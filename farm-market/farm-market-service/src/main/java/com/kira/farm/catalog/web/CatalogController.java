package com.kira.farm.catalog.web;

import com.kira.farm.catalog.application.CatalogService;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.farm.catalog.application.CatalogDtos.*;

@Tag(name = "Catalog")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CatalogController {
    private final CatalogService service;

    @GetMapping("/categories")
    public List<CategoryResponse> categories() {
        return service.categories();
    }

    /** sort: popular | newest | price_asc | price_desc | rating. category is a category slug. */
    @GetMapping("/products")
    public PageResponse<ProductSummary> search(@RequestParam(required = false) String q,
                                               @RequestParam(required = false) String category,
                                               @RequestParam(required = false) Long branchId,
                                               @RequestParam(required = false) Long minPrice,
                                               @RequestParam(required = false) Long maxPrice,
                                               @RequestParam(defaultValue = "false") boolean inStock,
                                               @RequestParam(defaultValue = "popular") String sort,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "12") int size) {
        return service.search(q, category, branchId, minPrice, maxPrice, inStock, sort, page, size);
    }

    @GetMapping("/products/{slug}")
    public ProductDetail detail(@PathVariable String slug) {
        return service.detail(slug);
    }
}
