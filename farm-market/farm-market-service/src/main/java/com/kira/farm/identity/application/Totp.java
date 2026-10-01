package com.kira.farm.identity.application;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;

/** RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30 s step) using only the JDK. Pure functions, no state. */
public final class Totp {
    public static final int STEP_SECONDS = 30;
    private static final String B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    public static long stepAt(long epochSeconds) {
        return epochSeconds / STEP_SECONDS;
    }

    /** 6-digit code for a time step (RFC 4226 dynamic truncation). */
    public static String code(byte[] key, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int o = h[h.length - 1] & 0x0f;
            int bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
            return String.format("%06d", bin % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Returns the accepted time step, or -1. Accepts current step +-1, but only a step strictly greater than
     * lastStep (replay protection). All three candidates are always compared, in constant time.
     */
    public static long match(byte[] key, long nowStep, Long lastStep, String submitted) {
        if (submitted == null || !submitted.matches("\\d{6}")) return -1;
        byte[] given = submitted.getBytes(StandardCharsets.US_ASCII);
        long found = -1;
        for (long s = nowStep - 1; s <= nowStep + 1; s++) {
            boolean eq = MessageDigest.isEqual(code(key, s).getBytes(StandardCharsets.US_ASCII), given);
            if (eq && (lastStep == null || s > lastStep)) found = s;
        }
        return found;
    }

    public static String newSecret() {
        byte[] b = new byte[20];
        RANDOM.nextBytes(b);
        return base32(b);
    }

    public static String base32(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buf = 0, bits = 0;
        for (byte x : data) {
            buf = (buf << 8) | (x & 0xff);
            bits += 8;
            while (bits >= 5) {
                sb.append(B32.charAt((buf >> (bits - 5)) & 31));
                bits -= 5;
            }
            buf &= (1 << bits) - 1;
        }
        if (bits > 0) sb.append(B32.charAt((buf << (5 - bits)) & 31));
        return sb.toString();
    }

    public static byte[] fromBase32(String s) {
        String in = s.replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int buf = 0, bits = 0;
        for (char c : in.toCharArray()) {
            int v = B32.indexOf(c);
            if (v < 0) throw new IllegalArgumentException("Invalid base32");
            buf = (buf << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.write((buf >> (bits - 8)) & 0xff);
                bits -= 8;
                buf &= (1 << bits) - 1;
            }
        }
        return out.toByteArray();
    }

    public static String otpauthUri(String issuer, String account, String base32Secret) {
        String i = enc(issuer);
        return "otpauth://totp/" + i + ":" + enc(account) + "?secret=" + base32Secret + "&issuer=" + i;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
