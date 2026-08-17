package com.kira.bank.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "ai")
public record AiProviderConfiguration(
    boolean enabled,
    String baseUrl,
    String accountId,
    String apiToken,
    String model,
    Duration connectTimeout,
    Duration readTimeout
) {
    public boolean isConfigured() {
        return enabled
            && accountId != null && !accountId.isBlank()
            && apiToken != null && !apiToken.isBlank()
            && model != null && !model.isBlank();
    }
}
