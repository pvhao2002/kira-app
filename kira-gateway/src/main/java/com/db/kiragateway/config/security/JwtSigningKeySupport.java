package com.db.kiragateway.config.security;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

final class JwtSigningKeySupport {

    private JwtSigningKeySupport() {
    }

    /**
     * HS256 requires at least 256 bits. Short env secrets (e.g. {@code kira-secret}) are stretched
     * deterministically so JWT encode/decode stay aligned without rotating APP_SECURITY_JWT_SECRET.
     */
    static SecretKeySpec hmacSha256Key(String secret) {
        var raw = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length >= 32) {
            return new SecretKeySpec(raw, "HmacSHA256");
        }
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(raw);
            return new SecretKeySpec(digest, "HmacSHA256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
