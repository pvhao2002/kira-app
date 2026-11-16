package com.kira.affiliate.order.application;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Maps one conversionReport node to rows. Tolerant on types: Shopee sends money as strings and ids as numbers. */
public final class ConversionMapper {
    private ConversionMapper() {
    }

    public record Conversion(String conversionId, Instant purchaseTime, Instant clickTime, String utmContent,
                             String buyerType, String device, String referrer, BigDecimal totalCommission,
                             BigDecimal sellerCommission, BigDecimal shopeeCommission, BigDecimal netCommission,
                             List<Item> items) {
    }

    public record Item(String orderId, String itemId, String modelId, String orderStatus, String fraudStatus,
                       String itemName, String shopId, String shopName, String imageUrl, String categoryLv1, int qty,
                       BigDecimal itemPrice, BigDecimal actualAmount, BigDecimal refundAmount,
                       BigDecimal itemTotalCommission, BigDecimal itemSellerCommission,
                       BigDecimal itemShopeeCommission, Instant completeTime, String itemNotes) {
    }

    /** @return null when the node lacks the identity fields (conversionId, purchaseTime) and cannot be stored. */
    public static Conversion parse(JsonNode n) {
        String conversionId = text(n, "conversionId", 40);
        Instant purchaseTime = time(n.path("purchaseTime"));
        if (conversionId == null || purchaseTime == null) return null;
        List<Item> items = new ArrayList<>();
        for (JsonNode order : n.path("orders")) {
            String orderId = text(order, "orderId", 40);
            String orderStatus = text(order, "orderStatus", 30);
            if (orderId == null) continue;
            for (JsonNode i : order.path("items")) {
                String itemId = text(i, "itemId", 40);
                if (itemId == null) continue;
                String modelId = text(i, "modelId", 40);
                items.add(new Item(orderId, itemId, modelId == null ? "" : modelId,
                    orderStatus == null ? "UNKNOWN" : orderStatus, text(i, "fraudStatus", 20), text(i, "itemName", 512),
                    text(i, "shopId", 40), text(i, "shopName", 255), text(i, "imageUrl", 512),
                    text(i, "globalCategoryLv1Name", 255), i.path("qty").asInt(0), money(i.path("itemPrice")),
                    money(i.path("actualAmount")), money(i.path("refundAmount")), money(i.path("itemTotalCommission")),
                    money(i.path("itemSellerCommission")), money(i.path("itemShopeeCommissionCapped")),
                    time(i.path("completeTime")), text(i, "itemNotes", 512)));
            }
        }
        String utm = text(n, "utmContent", 255);
        return new Conversion(conversionId, purchaseTime, time(n.path("clickTime")), utm == null ? "" : utm,
            text(n, "buyerType", 20), text(n, "device", 20), text(n, "referrer", 255), money(n.path("totalCommission")),
            money(n.path("sellerCommission")), money(n.path("shopeeCommissionCapped")), money(n.path("netCommission")),
            items);
    }

    private static String text(JsonNode parent, String field, int max) {
        JsonNode node = parent.path(field);
        if (node.isMissingNode() || node.isNull()) return null;
        String value = node.asText().trim();
        return value.isEmpty() ? null : value.substring(0, Math.min(value.length(), max));
    }

    static BigDecimal money(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(node.asText().trim());
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }

    /** Unix seconds (number or numeric string) or an ISO-8601 instant; 0/blank/unparseable = absent. */
    static Instant time(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) return null;
        String value = node.asText().trim();
        if (value.isEmpty()) return null;
        try {
            long seconds = Long.parseLong(value);
            return seconds <= 0 ? null : Instant.ofEpochSecond(seconds);
        } catch (NumberFormatException ex) {
            try {
                return Instant.parse(value);
            } catch (RuntimeException ignored) {
                return null;
            }
        }
    }
}
