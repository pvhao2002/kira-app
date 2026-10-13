package com.kira.bank.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

/**
 * Free-plan thresholds are configurable because providers change them: R2 free tier is 10 GB-month per Cloudflare
 * account, Hugging Face free accounts include 100 GB of private storage.
 */
@ConfigurationProperties(prefix = "storage")
public record StorageProperties(BigDecimal r2FreeGb, HuggingFace huggingFace) {
    public BigDecimal safeR2FreeGb() {
        return r2FreeGb == null ? BigDecimal.TEN : r2FreeGb;
    }

    public HuggingFace safeHuggingFace() {
        return huggingFace == null ? new HuggingFace(null, null, null, null, null) : huggingFace;
    }

    /** Hugging Face Storage Bucket reached through its S3-compatible gateway (https://s3.hf.co/{namespace}). */
    public record HuggingFace(String namespace, String bucket, String accessKeyId, String secretAccessKey,
                              BigDecimal freeGb) {
        public boolean configured() {
            return !blank(namespace) && !blank(bucket) && !blank(accessKeyId) && !blank(secretAccessKey);
        }

        public BigDecimal safeFreeGb() {
            return freeGb == null ? BigDecimal.valueOf(100) : freeGb;
        }

        private static boolean blank(String value) {
            return value == null || value.isBlank();
        }
    }
}
