package com.kira.affiliate.shopee;

import com.kira.affiliate.shopee.infrastructure.ShopeeSigner;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ShopeeSignerTest {
    @Test
    void signsAppIdTimestampBodySecret() {
        // Expected digest computed independently: printf '1234561577836800{"query":"x"}secretXYZ' | shasum -a 256
        assertEquals("SHA256 Credential=123456, Timestamp=1577836800, "
                + "Signature=68e59bedab253449e8dea53ee2893856c75a01e7ebc6dcf64b60e5f5d6a864d6",
            ShopeeSigner.authorization("123456", "secretXYZ", 1577836800L,
                "{\"query\":\"x\"}".getBytes(StandardCharsets.UTF_8)));
    }
}
