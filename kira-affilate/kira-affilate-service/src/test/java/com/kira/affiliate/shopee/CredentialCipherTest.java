package com.kira.affiliate.shopee;

import com.kira.affiliate.shopee.infrastructure.CredentialCipher;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class CredentialCipherTest {
    private static String key(int fill) {
        byte[] bytes = new byte[32];
        java.util.Arrays.fill(bytes, (byte) fill);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void roundTripsAndNeverStoresPlaintext() {
        CredentialCipher cipher = new CredentialCipher(key(1));
        String stored = cipher.encrypt("my-shopee-secret");
        assertTrue(stored.startsWith("v1:"));
        assertFalse(stored.contains("my-shopee-secret"));
        assertNotEquals(stored, cipher.encrypt("my-shopee-secret"), "random IV per encryption");
        assertEquals("my-shopee-secret", cipher.decrypt(stored));
    }

    @Test
    void rejectsWrongKeyTamperingAndBadConfig() {
        String stored = new CredentialCipher(key(1)).encrypt("s");
        assertThrows(IllegalStateException.class, () -> new CredentialCipher(key(2)).decrypt(stored));
        assertThrows(IllegalStateException.class, () -> new CredentialCipher(key(1)).decrypt(stored.substring(0, stored.length() - 4) + "AAAA"));
        assertThrows(IllegalStateException.class, () -> new CredentialCipher("c2hvcnQ="));
        assertFalse(new CredentialCipher("").isConfigured());
    }
}
