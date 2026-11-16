package com.kira.affiliate.shopee.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.kira.affiliate.shopee.application.ShopeeCredentialService;
import com.kira.affiliate.shopee.application.ShopeeCredentialService.SaveRequest;
import com.kira.affiliate.shopee.application.ShopeeCredentialService.Status;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.Credentials;
import com.kira.affiliate.shopee.infrastructure.ShopeeApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/shopee")
@RequiredArgsConstructor
public class ShopeeController {
    private final ShopeeCredentialService credentials;
    private final ShopeeAffiliateClient client;

    public record OfferPage(JsonNode items, int page, int limit, boolean hasNextPage) {
    }

    private interface OfferCall {
        JsonNode run(Credentials credentials);
    }

    @GetMapping("/credentials")
    public Status status(@AuthenticationPrincipal Long userId) {
        return credentials.status(userId);
    }

    @PutMapping("/credentials")
    public Status save(@AuthenticationPrincipal Long userId, @Valid @RequestBody SaveRequest request) {
        credentials.save(userId, request);
        return credentials.test(userId);
    }

    @PostMapping("/credentials/test")
    public Status test(@AuthenticationPrincipal Long userId) {
        return credentials.test(userId);
    }

    @DeleteMapping("/credentials")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long userId) {
        credentials.delete(userId);
    }

    @GetMapping("/offers/products")
    public OfferPage products(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "") @Size(max = 100) String keyword,
                              @RequestParam(defaultValue = "1") @Min(1) @Max(5) int sortType,
                              @RequestParam(defaultValue = "1") @Min(1) @Max(1000) int page,
                              @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        return offers(userId, page, limit, c -> client.productOffers(c, keyword, sortType, page, limit));
    }

    @GetMapping("/offers/shops")
    public OfferPage shops(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "") @Size(max = 100) String keyword,
                           @RequestParam(defaultValue = "1") @Min(1) @Max(3) int sortType,
                           @RequestParam(defaultValue = "1") @Min(1) @Max(1000) int page,
                           @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        return offers(userId, page, limit, c -> client.shopOffers(c, keyword, sortType, page, limit));
    }

    @GetMapping("/offers/campaigns")
    public OfferPage campaigns(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "") @Size(max = 100) String keyword,
                               @RequestParam(defaultValue = "1") @Min(1) @Max(2) int sortType,
                               @RequestParam(defaultValue = "1") @Min(1) @Max(1000) int page,
                               @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        return offers(userId, page, limit, c -> client.shopeeOffers(c, keyword, sortType, page, limit));
    }

    private OfferPage offers(Long userId, int page, int limit, OfferCall call) {
        Credentials resolved = credentials.require(userId);
        try {
            JsonNode result = call.run(resolved);
            return new OfferPage(result.path("nodes"), page, limit, result.path("pageInfo").path("hasNextPage").asBoolean(false));
        } catch (ShopeeApiException ex) {
            credentials.recordResult(userId, ex);
            throw ex.toApi();
        }
    }
}
