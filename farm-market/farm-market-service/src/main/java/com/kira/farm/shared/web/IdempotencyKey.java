package com.kira.farm.shared.web;

import java.util.regex.Pattern;

/** Validates the Idempotency-Key request header (8-64 url-safe characters). */
public final class IdempotencyKey {
    public static final String HEADER = "Idempotency-Key";
    private static final Pattern VALID = Pattern.compile("^[A-Za-z0-9_.:-]{8,64}$");

    private IdempotencyKey() {
    }

    public static String require(String key) {
        if (key == null || key.isBlank())
            throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Thiếu tiêu đề Idempotency-Key");
        String trimmed = key.trim();
        if (!VALID.matcher(trimmed).matches())
            throw ApiException.badRequest("IDEMPOTENCY_KEY_INVALID", "Idempotency-Key phải gồm 8-64 ký tự chữ, số, _ - . :");
        return trimmed;
    }
}
