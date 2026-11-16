package com.kira.affiliate.shopee.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Authorization header of the Shopee Affiliate Open API: sha256(appId + timestamp + body + secret), hex. */
public final class ShopeeSigner {
    private ShopeeSigner() {
    }

    /** {@code body} must be the exact bytes that are sent; re-serialising after signing breaks the signature. */
    public static String authorization(String appId, String secret, long timestampSeconds, byte[] body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update((appId + timestampSeconds).getBytes(StandardCharsets.UTF_8));
            digest.update(body);
            digest.update(secret.getBytes(StandardCharsets.UTF_8));
            return "SHA256 Credential=" + appId + ", Timestamp=" + timestampSeconds
                + ", Signature=" + HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
