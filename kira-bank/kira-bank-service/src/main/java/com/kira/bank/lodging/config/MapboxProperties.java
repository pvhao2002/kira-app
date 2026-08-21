package com.kira.bank.lodging.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.time.Duration;

@ConfigurationProperties(prefix = "mapbox")
public record MapboxProperties(String accessToken, Duration connectTimeout, Duration readTimeout) {}
