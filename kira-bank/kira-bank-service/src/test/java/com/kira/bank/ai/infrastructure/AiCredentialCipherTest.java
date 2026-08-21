package com.kira.bank.ai.infrastructure;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class AiCredentialCipherTest {
    @Test
    void encryptsWithoutPersistingPlaintextAndDecrypts() {
        String key = Base64.getEncoder().encodeToString(new byte[32]);
        AiCredentialCipher cipher = new AiCredentialCipher(key);

        String encrypted = cipher.encrypt("secret-cloudflare-token");

        assertNotEquals("secret-cloudflare-token", encrypted);
        assertFalse(encrypted.contains("secret-cloudflare-token"));
        assertEquals("secret-cloudflare-token", cipher.decrypt(encrypted));
    }

    @Test
    void refusesEncryptionWithoutAConfiguredKey() {
        AiCredentialCipher cipher = new AiCredentialCipher("");

        assertFalse(cipher.isConfigured());
        assertThrows(IllegalStateException.class, () -> cipher.encrypt("token"));
    }
}
