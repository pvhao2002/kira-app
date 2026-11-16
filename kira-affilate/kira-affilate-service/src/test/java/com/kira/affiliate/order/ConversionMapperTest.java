package com.kira.affiliate.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.affiliate.order.application.ConversionMapper;
import com.kira.affiliate.order.application.ConversionMapper.Conversion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ConversionMapperTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void mapsStringMoneyNumericIdsAndUnixTimes() throws Exception {
        Conversion c = ConversionMapper.parse(JSON.readTree("""
            {"conversionId": 9001, "purchaseTime": 1700000000, "clickTime": "1699990000", "utmContent": "tiktok-v1",
             "totalCommission": "12500.50", "netCommission": "12000", "buyerType": "NEW",
             "orders": [{"orderId": "ORD1", "orderStatus": "PENDING", "items": [
               {"itemId": 77, "modelId": 5, "itemName": "Áo thun", "qty": 2, "actualAmount": "250000",
                "itemTotalCommission": "12500.50", "completeTime": 0},
               {"itemId": 78, "itemName": "Quần"}]},
               {"orderStatus": "PENDING", "items": [{"itemId": 1}]}]}"""));
        assertEquals("9001", c.conversionId());
        assertEquals(Instant.ofEpochSecond(1700000000L), c.purchaseTime());
        assertEquals(Instant.ofEpochSecond(1699990000L), c.clickTime());
        assertEquals(new BigDecimal("12500.50"), c.totalCommission());
        assertEquals(BigDecimal.ZERO, c.sellerCommission());
        assertEquals(2, c.items().size(), "order without orderId is skipped");
        assertEquals("5", c.items().get(0).modelId());
        assertEquals("", c.items().get(1).modelId());
        assertNull(c.items().get(0).completeTime());
        assertEquals(new BigDecimal("250000"), c.items().get(0).actualAmount());
    }

    @Test
    void skipsNodesWithoutIdentity() throws Exception {
        assertNull(ConversionMapper.parse(JSON.readTree("{\"purchaseTime\": 1700000000}")));
        assertNull(ConversionMapper.parse(JSON.readTree("{\"conversionId\": \"x\"}")));
        assertNotNull(ConversionMapper.parse(JSON.readTree("{\"conversionId\": \"x\", \"purchaseTime\": \"2026-01-01T00:00:00Z\"}")));
    }
}
