package com.kira.memory.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Media URLs are capability URLs: /m/{id}/{hmac}/o.{ext} (original) and /m/{id}/{hmac}/t.jpg (thumbnail).
 * They never change for a media id and need no cookie, so Cloudflare can cache them for a year; the HMAC
 * makes them unguessable. The file extension is there because Cloudflare caches by extension by default.
 */
@Component
public class MediaUrls {
    private final byte[] secret;
    private final String base;

    public MediaUrls(@Value("${app.media-url-secret}") String secret, @Value("${app.media-base-url}") String base) {
        if (secret == null || secret.length() < 32) throw new IllegalStateException("MEDIA_URL_SECRET must be at least 32 chars");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.base = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    public String original(long id, String objectKey) {
        return base + "/m/" + id + "/" + sign(id, "o") + "/o." + extension(objectKey);
    }

    public String thumb(long id) {
        return base + "/m/" + id + "/" + sign(id, "t") + "/t.jpg";
    }

    public boolean valid(long id, String variant, String signature) {
        return MessageDigest.isEqual(sign(id, variant).getBytes(StandardCharsets.US_ASCII),
            signature.getBytes(StandardCharsets.US_ASCII));
    }

    public static String extension(String objectKey) {
        return objectKey.substring(objectKey.lastIndexOf('.') + 1);
    }

    String sign(long id, String variant) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] h = mac.doFinal((id + ":" + variant).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h).substring(0, 22);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
