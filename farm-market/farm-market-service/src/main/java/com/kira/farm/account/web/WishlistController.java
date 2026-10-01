package com.kira.farm.account.web;

import com.kira.farm.account.application.WishlistService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.farm.account.application.AccountDtos.WishlistEntry;

@Tag(name = "Wishlist")
@RestController
@RequestMapping("/api/v1/wishlist")
@RequiredArgsConstructor
public class WishlistController {
    private final WishlistService service;

    /** branchId: branch whose stock decides availability (defaults to each product's own branch). */
    @GetMapping
    public List<WishlistEntry> list(@RequestParam(required = false) Long branchId) {
        return service.list(branchId);
    }

    @PutMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@PathVariable Long productId) {
        service.add(productId);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long productId) {
        service.remove(productId);
    }
}
