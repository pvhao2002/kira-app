package com.kira.bank.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "ai")
public record AiProviderConfiguration(
    Duration connectTimeout,
    Duration readTimeout,
    Duration accountRateLimitCooldown
) {}
