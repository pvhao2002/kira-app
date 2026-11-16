package com.kira.affiliate.it;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.affiliate.shopee.infrastructure.ShopeeSigner;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-process stand-in for the Shopee Affiliate GraphQL endpoint. It verifies the request signature exactly as
 * documented, so a wrong signature or a re-serialised body fails the tests with error 10020.
 */
final class ShopeeStub {
    static final class Account {
        final String secret;
        volatile String orderStatus = "PENDING";
        volatile boolean rateLimited;
        final List<String> queries = new CopyOnWriteArrayList<>();

        Account(String secret) {
            this.secret = secret;
        }
    }

    private static final Pattern AUTH = Pattern.compile("SHA256 Credential=(\\d+), Timestamp=(\\d+), Signature=([0-9a-f]{64})");
    private static final ObjectMapper JSON = new ObjectMapper();
    final Map<String, Account> accounts = new ConcurrentHashMap<>();
    final AtomicInteger links = new AtomicInteger();
    private final HttpServer server;

    ShopeeStub() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.createContext("/graphql", exchange -> {
            byte[] body = exchange.getRequestBody().readAllBytes();
            byte[] out = respond(exchange.getRequestHeaders().getFirst("Authorization"), body).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
    }

    String endpoint() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/graphql";
    }

    private String respond(String authorization, byte[] body) throws IOException {
        Matcher m = AUTH.matcher(authorization == null ? "" : authorization);
        if (!m.matches()) return error(10020, "Invalid Authorization Header");
        Account account = accounts.get(m.group(1));
        long timestamp = Long.parseLong(m.group(2));
        if (account == null || Math.abs(Instant.now().getEpochSecond() - timestamp) > 300
            || !ShopeeSigner.authorization(m.group(1), account.secret, timestamp, body).equals(authorization))
            return error(10020, "Invalid Signature");
        String query = JSON.readTree(body).path("query").asText();
        account.queries.add(query);
        if (account.rateLimited) return error(10030, "Rate limit exceeded");
        if (query.contains("generateShortLink"))
            return "{\"data\":{\"generateShortLink\":{\"shortLink\":\"https://s.shopee.vn/t" + links.incrementAndGet() + "\"}}}";
        if (query.contains("productOfferV2"))
            return "{\"data\":{\"productOfferV2\":{\"nodes\":[{\"itemId\":1,\"productName\":\"Áo\",\"commissionRate\":\"0.05\","
                + "\"productLink\":\"https://shopee.vn/a-i.1.1\"}],\"pageInfo\":{\"page\":1,\"limit\":20,\"hasNextPage\":false}}}}";
        if (query.contains("validatedReport"))
            return "{\"data\":{\"validatedReport\":{\"nodes\":[{\"conversionId\":\"C1\"}],\"pageInfo\":{\"hasNextPage\":false,\"scrollId\":\"\"}}}}";
        if (query.contains("conversionReport")) {
            long purchase = Instant.now().minusSeconds(86_400).getEpochSecond();
            if (!query.contains("scrollId:\""))
                return "{\"data\":{\"conversionReport\":{\"nodes\":[" + conversion("C1", purchase, "tiktok-v1", account.orderStatus,
                    item(101, "Áo thun", "100000", "5000") + "," + item(102, "Quần jean", "300000", "15000"))
                    + "],\"pageInfo\":{\"hasNextPage\":true,\"scrollId\":\"page2\"}}}}";
            return "{\"data\":{\"conversionReport\":{\"nodes\":[" + conversion("C2", purchase, "", "CANCELLED",
                item(103, "Giày", "500000", "25000")) + "],\"pageInfo\":{\"hasNextPage\":false,\"scrollId\":\"\"}}}}";
        }
        return error(11001, "Params Error: unknown operation");
    }

    private static String conversion(String id, long purchase, String utm, String status, String items) {
        return "{\"conversionId\":\"" + id + "\",\"purchaseTime\":" + purchase + ",\"clickTime\":" + (purchase - 60)
            + ",\"utmContent\":\"" + utm + "\",\"buyerType\":\"NEW\",\"device\":\"APP\",\"totalCommission\":\"20000\","
            + "\"netCommission\":\"20000\",\"orders\":[{\"orderId\":\"O-" + id + "\",\"orderStatus\":\"" + status
            + "\",\"items\":[" + items + "]}]}";
    }

    private static String item(int itemId, String name, String amount, String commission) {
        return "{\"itemId\":" + itemId + ",\"modelId\":1,\"itemName\":\"" + name + "\",\"shopId\":9,\"shopName\":\"Shop A\","
            + "\"qty\":1,\"itemPrice\":\"" + amount + "\",\"actualAmount\":\"" + amount + "\",\"itemTotalCommission\":\""
            + commission + "\",\"fraudStatus\":\"UNVERIFIED\",\"globalCategoryLv1Name\":\"Thời trang\"}";
    }

    private static String error(int code, String message) {
        return "{\"errors\":[{\"message\":\"error [" + code + "]: " + message + "\",\"extensions\":{\"code\":" + code + "}}]}";
    }
}
