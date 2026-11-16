package com.kira.affiliate.shopee.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Shopee Affiliate Open API (GraphQL). Only the documented operations below are called. The endpoint comes from
 * configuration, never from user input. Responses and secrets are never logged.
 */
@Component
public class ShopeeAffiliateClient {
    private static final Logger log = LoggerFactory.getLogger(ShopeeAffiliateClient.class);
    public static final int REPORT_PAGE_SIZE = 500;

    private static final String CONVERSION_FIELDS = """
        nodes{purchaseTime clickTime conversionId buyerType utmContent device referrer \
        shopeeCommissionCapped sellerCommission totalCommission netCommission \
        orders{orderId orderStatus items{shopId shopName itemId itemName modelId imageUrl itemPrice actualAmount \
        qty refundAmount completeTime fraudStatus itemNotes itemTotalCommission itemSellerCommission \
        itemShopeeCommissionCapped globalCategoryLv1Name}}} pageInfo{hasNextPage scrollId}""";

    public record Credentials(String appId, String secret) {
        @Override
        public String toString() {
            return "Credentials[appId=" + appId + "]";
        }
    }

    public record ReportPage(List<JsonNode> nodes, String scrollId, boolean hasNextPage) {
    }

    private final RestClient http;
    private final ObjectMapper json;
    private final int maxAttempts;
    private final Duration backoff;

    public ShopeeAffiliateClient(RestClient.Builder builder, ObjectMapper json,
                                 @Value("${shopee.endpoint}") String endpoint,
                                 @Value("${shopee.connect-timeout:5s}") Duration connectTimeout,
                                 @Value("${shopee.read-timeout:20s}") Duration readTimeout,
                                 @Value("${shopee.max-attempts:3}") int maxAttempts,
                                 @Value("${shopee.retry-backoff:2s}") Duration backoff) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.http = builder.baseUrl(endpoint).requestFactory(factory).build();
        this.json = json;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.backoff = backoff;
    }

    public String generateShortLink(Credentials credentials, String originUrl, List<String> subIds) {
        String subs = subIds.isEmpty() ? "" : ",subIds:[" + subIds.stream().map(this::quote).collect(Collectors.joining(",")) + "]";
        JsonNode data = execute(credentials,
            "mutation{generateShortLink(input:{originUrl:" + quote(originUrl) + subs + "}){shortLink}}");
        String link = data.path("generateShortLink").path("shortLink").asText("");
        if (link.isBlank()) throw new ShopeeApiException(0, "empty shortLink");
        return link;
    }

    public JsonNode productOffers(Credentials credentials, String keyword, int sortType, int page, int limit) {
        return offers(credentials, "productOfferV2", keyword, sortType, page, limit,
            "itemId productName imageUrl priceMin priceMax sales ratingStar commissionRate commission shopName productLink offerLink");
    }

    public JsonNode shopOffers(Credentials credentials, String keyword, int sortType, int page, int limit) {
        return offers(credentials, "shopOfferV2", keyword, sortType, page, limit,
            "shopId shopName imageUrl commissionRate ratingStar originalLink offerLink periodStartTime periodEndTime");
    }

    public JsonNode shopeeOffers(Credentials credentials, String keyword, int sortType, int page, int limit) {
        return offers(credentials, "shopeeOfferV2", keyword, sortType, page, limit,
            "offerName imageUrl commissionRate originalLink offerLink periodStartTime periodEndTime");
    }

    /** Cheapest read-only call, used to check that the credentials work. */
    public void ping(Credentials credentials) {
        execute(credentials, "{productOfferV2(limit:1){nodes{itemId}}}");
    }

    public ReportPage conversionReport(Credentials credentials, long purchaseTimeStart, long purchaseTimeEnd, String scrollId) {
        String args = "purchaseTimeStart:" + purchaseTimeStart + ",purchaseTimeEnd:" + purchaseTimeEnd
            + ",limit:" + REPORT_PAGE_SIZE + scroll(scrollId);
        return page(execute(credentials, "{conversionReport(" + args + "){" + CONVERSION_FIELDS + "}}").path("conversionReport"));
    }

    public ReportPage validatedReport(Credentials credentials, long validationId, String scrollId) {
        String args = "validationId:" + validationId + ",limit:" + REPORT_PAGE_SIZE + scroll(scrollId);
        return page(execute(credentials,
            "{validatedReport(" + args + "){nodes{conversionId} pageInfo{hasNextPage scrollId}}}").path("validatedReport"));
    }

    private JsonNode offers(Credentials credentials, String operation, String keyword, int sortType, int page, int limit,
                            String fields) {
        String args = (keyword == null || keyword.isBlank() ? "" : "keyword:" + quote(keyword.trim()) + ",")
            + "sortType:" + sortType + ",page:" + page + ",limit:" + limit;
        return execute(credentials,
            "{" + operation + "(" + args + "){nodes{" + fields + "} pageInfo{page limit hasNextPage}}}").path(operation);
    }

    private String scroll(String scrollId) {
        return scrollId == null || scrollId.isBlank() ? "" : ",scrollId:" + quote(scrollId);
    }

    private static ReportPage page(JsonNode report) {
        List<JsonNode> nodes = new ArrayList<>();
        report.path("nodes").forEach(nodes::add);
        JsonNode info = report.path("pageInfo");
        return new ReportPage(nodes, info.path("scrollId").asText(""), info.path("hasNextPage").asBoolean(false));
    }

    /** A JSON string literal is a valid GraphQL string literal, so user text can never break out of the quotes. */
    private String quote(String value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private JsonNode execute(Credentials credentials, String query) {
        byte[] body;
        try {
            body = json.writeValueAsBytes(Map.of("query", query));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
        for (int attempt = 1; ; attempt++) {
            String failure;
            try {
                // Signed per attempt: the timestamp must be fresh.
                String authorization = ShopeeSigner.authorization(credentials.appId(), credentials.secret(),
                    Instant.now().getEpochSecond(), body);
                JsonNode root = http.post().contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, authorization).body(body).retrieve().body(JsonNode.class);
                return data(root);
            } catch (RestClientResponseException ex) {
                if (!ex.getStatusCode().is5xxServerError()) throw new ShopeeApiException(0, "HTTP " + ex.getStatusCode().value());
                failure = "HTTP " + ex.getStatusCode().value();
            } catch (ResourceAccessException ex) {
                failure = "I/O";
            }
            if (attempt >= maxAttempts) throw new ShopeeApiException(0, failure);
            log.warn("Shopee API attempt {} failed ({}), retrying", attempt, failure);
            sleep(backoff.multipliedBy(attempt));
        }
    }

    private static JsonNode data(JsonNode root) {
        if (root == null) throw new ShopeeApiException(0, "empty response");
        JsonNode error = root.path("errors").path(0);
        if (!error.isMissingNode()) {
            String message = error.path("message").asText("");
            throw new ShopeeApiException(error.path("extensions").path("code").asInt(0),
                message.substring(0, Math.min(message.length(), 200)));
        }
        return root.path("data");
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ShopeeApiException(0, "interrupted");
        }
    }
}
