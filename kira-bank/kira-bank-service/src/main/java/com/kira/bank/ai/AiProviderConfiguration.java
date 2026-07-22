package com.kira.bank.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "ai")
public record AiProviderConfiguration(boolean enabled, String baseUrl, String apiKey, Duration connectTimeout,
                                      Duration readTimeout) {
}

