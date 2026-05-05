package com.db.kiragateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.gemini")
public class GeminiProperties {

    /**
     * Base URL of Gemini Generative Language API.
     */
    private String baseUrl = "https://generativelanguage.googleapis.com";

    /**
     * Gemini model name without API version prefix.
     */
    private String model = "gemini-3.1-pro-preview";

    /**
     * Gemini API key.
     */
    private String apiKey;

    /**
     * Upstream connect timeout.
     */
    private Duration connectTimeout = Duration.ofSeconds(5);

    /**
     * Upstream read timeout.
     */
    private Duration readTimeout = Duration.ofSeconds(30);

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(Duration connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    public Duration getReadTimeout() {
        return readTimeout;
    }

    public void setReadTimeout(Duration readTimeout) {
        this.readTimeout = readTimeout;
    }
}
