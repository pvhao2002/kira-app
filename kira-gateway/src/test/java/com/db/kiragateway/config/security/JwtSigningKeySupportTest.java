package com.db.kiragateway.config.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class JwtSigningKeySupportTest {

    @Test
    void stretchesShortSecretsTo256Bits() {
        var key = JwtSigningKeySupport.hmacSha256Key("kira-secret");
        assertEquals("HmacSHA256", key.getAlgorithm());
        assertEquals(32, key.getEncoded().length);
    }

    @Test
    void keepsLongSecretsAsIs() {
        var secret = "change-me-in-production-change-me-in-production";
        var key = JwtSigningKeySupport.hmacSha256Key(secret);
        assertArrayEquals(secret.getBytes(), key.getEncoded());
    }
}
