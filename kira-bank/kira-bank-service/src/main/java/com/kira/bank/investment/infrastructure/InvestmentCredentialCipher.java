package com.kira.bank.investment.infrastructure;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class InvestmentCredentialCipher {
    private static final byte FORMAT_VERSION = 1;
    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private final byte[] key;

    public InvestmentCredentialCipher(@Value("${investment.credential-encryption-key:}") String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            this.key = null;
            return;
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(encodedKey.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Investment credential encryption key must be Base64", ex);
        }
        if (decoded.length != 32) {
            throw new IllegalStateException("Investment credential encryption key must decode to 32 bytes");
        }
        this.key = decoded;
    }

    public boolean isConfigured() {
        return key != null;
    }

    public boolean isCiphertext(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public String encrypt(String value) {
        requireKey();
        byte[] iv = new byte[IV_BYTES];
        random.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(1 + iv.length + encrypted.length)
                .put(FORMAT_VERSION).put(iv).put(encrypted).array());
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to encrypt investment credential", ex);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new IllegalStateException("Investment credential encryption key is not configured");
        }
    }
}
