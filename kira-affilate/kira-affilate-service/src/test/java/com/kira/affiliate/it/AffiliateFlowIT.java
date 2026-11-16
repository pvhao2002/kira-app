package com.kira.affiliate.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.kira.affiliate.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AffiliateFlowIT extends IntegrationTestBase {
    @Test
    void credentialsAreEncryptedNeverReturnedAndVerified() {
        TestUser user = newUser();
        assertFalse(api.get("/api/v1/shopee/credentials", user.token()).json().path("configured").asBoolean());
        assertEquals("SHOPEE_NOT_CONNECTED", api.get("/api/v1/shopee/offers/products", user.token()).code());

        String appId = connect(user);
        String secret = SHOPEE.accounts.get(appId).secret;
        String stored = jdbc.queryForObject("SELECT secret_enc FROM shopee_credentials WHERE user_id=?", String.class, user.id());
        assertTrue(stored.startsWith("v1:"));
        assertFalse(stored.contains(secret));
        Res status = api.get("/api/v1/shopee/credentials", user.token());
        assertFalse(status.json().toString().contains(secret));
        assertFalse(status.json().has("secret"));
        assertEquals(appId, status.str("appId"));

        Res offers = api.get("/api/v1/shopee/offers/products?keyword=áo\"})", user.token());
        assertEquals(200, offers.status(), offers.json().toString());
        assertEquals("Áo", offers.json().path("items").path(0).path("productName").asText());

        // A wrong secret is reported by Shopee (10020) and surfaces as a status, not as a server error.
        Res wrong = api.put("/api/v1/shopee/credentials", user.token(), Api.map("appId", appId, "secret", "wrong-secret-value"));
        assertEquals(200, wrong.status());
        assertEquals("INVALID_CREDENTIAL", wrong.str("lastStatus"));
        assertEquals(10020, wrong.json().path("lastErrorCode").asInt());
        assertEquals(400, api.put("/api/v1/shopee/credentials", user.token(), Api.map("appId", "abc", "secret", "x")).status());

        assertEquals(204, api.delete("/api/v1/shopee/credentials", user.token()).status());
        assertFalse(api.get("/api/v1/shopee/credentials", user.token()).json().path("configured").asBoolean());
    }

    @Test
    void convertsLinksKeepsHistoryAndIsolatesUsers() {
        TestUser a = newUser(), b = newUser();
        String appId = connect(a);
        connect(b);
        Res campaign = api.post("/api/v1/campaigns", a.token(), Api.map("name", "TikTok T11", "subIds", List.of("tiktok", "v1")));
        assertEquals(201, campaign.status(), campaign.json().toString());
        assertEquals(409, api.post("/api/v1/campaigns", a.token(), Api.map("name", "TikTok T11", "subIds", List.of("x"))).status());
        assertEquals(400, api.post("/api/v1/campaigns", a.token(), Api.map("name", "Bad", "subIds", List.of("a-b"))).status());

        Res converted = api.post("/api/v1/links/convert", a.token(), Api.map("campaignId", campaign.num("id"), "urls",
            List.of("https://shopee.vn/Ao-i.1.2", "https://evil.example.com/x", "http://shopee.vn/x")));
        assertEquals(200, converted.status(), converted.json().toString());
        JsonNode results = converted.json().path("results");
        assertEquals("OK", results.path(0).path("status").asText());
        assertTrue(results.path(0).path("shortLink").asText().startsWith("https://s.shopee.vn/"));
        assertEquals("FAILED", results.path(1).path("status").asText());
        assertEquals("FAILED", results.path(2).path("status").asText());
        String sent = SHOPEE.accounts.get(appId).queries.stream().filter(q -> q.contains("generateShortLink")).findFirst().orElseThrow();
        assertTrue(sent.contains("subIds:[\"tiktok\",\"v1\"]"), sent);
        assertEquals(1, SHOPEE.accounts.get(appId).queries.stream().filter(q -> q.contains("generateShortLink")).count(),
            "invalid URLs are never sent to Shopee");

        assertEquals(400, api.post("/api/v1/links/convert", a.token(), Api.map("campaignId", campaign.num("id"),
            "subIds", List.of("x"), "urls", List.of("https://shopee.vn/a"))).status());
        assertEquals(400, api.post("/api/v1/links/convert", a.token(), Api.map("urls", List.of())).status());
        // B cannot use A's campaign.
        assertEquals(404, api.post("/api/v1/links/convert", b.token(), Api.map("campaignId", campaign.num("id"),
            "urls", List.of("https://shopee.vn/a"))).status());

        Res mine = api.get("/api/v1/links?search=Ao-i&status=OK", a.token());
        assertEquals(1, mine.json().path("meta").path("totalElements").asInt(), mine.json().toString());
        assertEquals("TikTok T11", mine.json().path("data").path(0).path("campaignName").asText());
        assertEquals(List.of("tiktok", "v1").toString(), "[" + mine.json().path("data").path(0).path("subIds").path(0).asText()
            + ", " + mine.json().path("data").path(0).path("subIds").path(1).asText() + "]");
        assertEquals(1, api.get("/api/v1/links", a.token()).json().path("meta").path("totalElements").asInt(),
            "only the attempted conversion is stored; rejected URLs never reach Shopee or history");
        long linkId = mine.json().path("data").path(0).path("id").asLong();

        assertEquals(0, api.get("/api/v1/links", b.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(0, api.get("/api/v1/campaigns", b.token()).json().size());
        assertEquals(404, api.delete("/api/v1/links/" + linkId, b.token()).status());
        assertEquals(404, api.delete("/api/v1/campaigns/" + campaign.num("id"), b.token()).status());
        assertEquals(404, api.put("/api/v1/campaigns/" + campaign.num("id"), b.token(), Api.map("name", "Hack", "subIds", List.of("h"))).status());

        String csv = api.text("/api/v1/links/export", a.token());
        assertTrue(csv.startsWith("﻿\"Thời gian tạo\""), csv);
        assertTrue(csv.contains("https://shopee.vn/Ao-i.1.2"));
        assertFalse(api.text("/api/v1/links/export", b.token()).contains("Ao-i.1.2"));
        assertEquals(204, api.delete("/api/v1/links/" + linkId, a.token()).status());
    }

    @Test
    void syncIsIdempotentPaginatedAndIsolated() {
        TestUser a = newUser(), b = newUser();
        String appId = connect(a);
        connect(b);
        assertEquals(201, api.post("/api/v1/campaigns", a.token(), Api.map("name", "TikTok", "subIds", List.of("tiktok", "v1"))).status());

        Res first = syncAndWait(a, "/api/v1/sync", null);
        assertEquals("SUCCESS", first.json().path("lastRun").path("status").asText(), first.json().toString());
        assertEquals(3, first.json().path("lastRun").path("rowsUpserted").asInt());
        assertTrue(SHOPEE.accounts.get(appId).queries.stream().anyMatch(q -> q.contains("scrollId:\"page2\"")), "second page followed");
        assertEquals(3, count("conversion_items", a));
        assertEquals(2, count("conversions", a));

        // Same data again, with one status change upstream: rows are updated in place, never duplicated.
        SHOPEE.accounts.get(appId).orderStatus = "COMPLETED";
        syncAndWait(a, "/api/v1/sync", null);
        assertEquals(3, count("conversion_items", a));
        assertEquals(2, count("conversions", a));

        Res orders = api.get("/api/v1/orders?sort=commission,desc", a.token());
        assertEquals(3, orders.json().path("meta").path("totalElements").asInt());
        assertEquals("REJECTED", orders.json().path("data").path(0).path("bucket").asText());
        assertEquals("CONFIRMED", orders.json().path("data").path(1).path("bucket").asText());
        assertEquals(2, api.get("/api/v1/orders?bucket=CONFIRMED", a.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(1, api.get("/api/v1/orders?search=Giày", a.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(400, api.get("/api/v1/orders?sort=secret_enc,desc", a.token()).status());
        assertEquals(400, api.get("/api/v1/orders?bucket=NOPE", a.token()).status());

        Res summary = api.get("/api/v1/reports/summary", a.token());
        assertEquals(200, summary.status(), summary.json().toString());
        assertEquals(2, summary.json().path("orders").asInt());
        assertEquals(400000, summary.json().path("gmv").asInt(), "cancelled order excluded from GMV");
        assertEquals(20000, summary.json().path("commission").path("confirmed").asInt());
        assertEquals(25000, summary.json().path("commission").path("rejected").asInt());
        assertEquals(0, summary.json().path("commission").path("estimated").asInt());
        assertFalse(summary.json().path("clicksAvailable").asBoolean());
        for (String g : new String[]{"day", "week", "month"}) {
            Res series = api.get("/api/v1/reports/timeseries?granularity=" + g, a.token());
            assertEquals(200, series.status(), series.json().toString());
            assertEquals(20000, series.json().path(0).path("confirmed").asInt());
        }
        assertEquals(400, api.get("/api/v1/reports/timeseries?granularity=year", a.token()).status());
        assertEquals(400, api.get("/api/v1/reports/summary?from=2026-02-01&to=2026-01-01", a.token()).status());
        for (String by : new String[]{"product", "shop", "subId", "campaign", "status", "category", "device", "buyerType"})
            assertEquals(200, api.get("/api/v1/reports/top?by=" + by, a.token()).status(), by);
        Res byCampaign = api.get("/api/v1/reports/top?by=campaign", a.token());
        assertEquals("TikTok", byCampaign.json().path(0).path("label").asText(), byCampaign.json().toString());
        assertEquals(20000, byCampaign.json().path(0).path("commission").asInt());
        assertEquals(400, api.get("/api/v1/reports/top?by=password_hash", a.token()).status());

        // Validated report import moves C1 to the "validated for payout" bucket.
        Res validation = syncAndWait(a, "/api/v1/validations", Api.map("validationId", 555));
        assertEquals("SUCCESS", validation.json().path("lastRun").path("status").asText(), validation.json().toString());
        assertEquals(2, api.get("/api/v1/orders?bucket=VALIDATED", a.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(20000, api.get("/api/v1/reports/summary", a.token()).json().path("commission").path("validated").asInt());
        assertEquals(555, api.get("/api/v1/validations", a.token()).json().path(0).path("validationId").asInt());

        // B synced nothing and sees nothing of A, even though the conversion ids would collide.
        assertEquals(0, api.get("/api/v1/orders", b.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(0, api.get("/api/v1/reports/summary", b.token()).json().path("orders").asInt());
        assertEquals(0, api.get("/api/v1/sync/runs", b.token()).json().path("meta").path("totalElements").asInt());
        assertEquals(0, api.get("/api/v1/validations", b.token()).json().size());
        long orderId = orders.json().path("data").path(0).path("id").asLong();
        assertEquals(200, api.get("/api/v1/orders/" + orderId, a.token()).status());
        assertEquals(404, api.get("/api/v1/orders/" + orderId, b.token()).status());
        syncAndWait(b, "/api/v1/sync", null);
        assertEquals(3, count("conversion_items", b));
        assertEquals(3, count("conversion_items", a));
        assertEquals(0, api.get("/api/v1/orders?bucket=VALIDATED", b.token()).json().path("meta").path("totalElements").asInt(),
            "A's validation did not leak onto B's identical conversion ids");

        String csv = api.text("/api/v1/orders/export", a.token());
        assertTrue(csv.startsWith("﻿\"Thời gian mua\""));
        assertTrue(csv.contains("Đã đối soát thanh toán"));
        assertEquals(3, api.get("/api/v1/sync/runs", a.token()).json().path("meta").path("totalElements").asInt());
    }

    @Test
    void rateLimitAndMissingCredentialsAreReportedNotHidden() {
        TestUser user = newUser();
        assertEquals("SHOPEE_NOT_CONNECTED", api.post("/api/v1/sync", user.token(), null).code());
        String appId = connect(user);
        SHOPEE.accounts.get(appId).rateLimited = true;

        Res status = syncAndWait(user, "/api/v1/sync", null);
        assertEquals("RATE_LIMITED", status.json().path("lastRun").path("status").asText(), status.json().toString());
        assertEquals("SHOPEE_10030", status.json().path("lastRun").path("errorCode").asText());
        assertTrue(status.json().path("lastSuccessAt").isNull());
        assertEquals("RATE_LIMITED", api.get("/api/v1/shopee/credentials", user.token()).str("lastStatus"));

        Res converted = api.post("/api/v1/links/convert", user.token(),
            Api.map("urls", List.of("https://shopee.vn/a-i.1.1", "https://shopee.vn/b-i.1.2")));
        assertEquals("FAILED", converted.json().path("results").path(0).path("status").asText());
        assertEquals("FAILED", converted.json().path("results").path(1).path("status").asText());
        assertEquals(1, SHOPEE.accounts.get(appId).queries.stream().filter(q -> q.contains("generateShortLink")).count(),
            "stops calling Shopee after the first rate-limit answer");
        assertEquals(429, api.get("/api/v1/shopee/offers/products", user.token()).status());
    }

    private int count(String table, TestUser user) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id=?", Integer.class, user.id());
    }
}
