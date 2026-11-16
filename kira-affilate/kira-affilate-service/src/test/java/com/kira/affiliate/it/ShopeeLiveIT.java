package com.kira.affiliate.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.Credentials;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.ReportPage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Calls the REAL Shopee Affiliate Open API. Skipped unless SHOPEE_APP_ID and SHOPEE_SECRET are set. This is the test
 * that proves the query/field names in ShopeeAffiliateClient against Shopee's actual schema.
 */
@EnabledIfEnvironmentVariable(named = "SHOPEE_APP_ID", matches = "\\d+")
@EnabledIfEnvironmentVariable(named = "SHOPEE_SECRET", matches = "\\S+")
class ShopeeLiveIT {
    private final ShopeeAffiliateClient client = new ShopeeAffiliateClient(RestClient.builder(), new ObjectMapper(),
        "https://open-api.affiliate.shopee.vn/graphql", Duration.ofSeconds(5), Duration.ofSeconds(20), 1, Duration.ZERO);
    private final Credentials credentials = new Credentials(System.getenv("SHOPEE_APP_ID"), System.getenv("SHOPEE_SECRET"));

    @Test
    void offerQueriesMatchTheRealSchema() {
        JsonNode products = client.productOffers(credentials, "áo", 2, 1, 2);
        assertTrue(products.path("nodes").isArray(), products.toString());
        assertTrue(client.shopOffers(credentials, "", 1, 1, 2).path("nodes").isArray());
        assertTrue(client.shopeeOffers(credentials, "", 1, 1, 2).path("nodes").isArray());
    }

    @Test
    void generatesAShortLinkWithSubIds() {
        String link = client.generateShortLink(credentials, "https://shopee.vn/", List.of("kiratest", "live1"));
        assertTrue(link.startsWith("https://"), link);
    }

    @Test
    void conversionReportQueryMatchesTheRealSchema() {
        Instant now = Instant.now();
        ReportPage page = client.conversionReport(credentials, now.minus(Duration.ofDays(7)).getEpochSecond(),
            now.getEpochSecond(), null);
        assertNotNull(page.nodes());
    }
}
