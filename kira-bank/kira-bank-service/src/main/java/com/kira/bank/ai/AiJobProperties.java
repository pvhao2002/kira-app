package com.kira.bank.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "ai.job")
public record AiJobProperties(
    int batchSize,
    int maxAttempts,
    Duration retryDelay,
    Duration processingTimeout
) {
    public int safeBatchSize() {
        return batchSize <= 0 ? 3 : Math.min(batchSize, 3);
    }

    public int safeMaxAttempts() {
        return maxAttempts <= 0 ? 3 : maxAttempts;
    }

    public Duration safeRetryDelay() {
        return retryDelay == null || retryDelay.isNegative() || retryDelay.isZero() ? Duration.ofHours(3) : retryDelay;
    }

    public Duration safeProcessingTimeout() {
        return processingTimeout == null || processingTimeout.isNegative() || processingTimeout.isZero()
            ? Duration.ofMinutes(30) : processingTimeout;
    }
}
