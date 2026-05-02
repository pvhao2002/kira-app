package com.db.kiragateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.data-manager")
public class DataManagerProperties {

    /**
     * Base URL of kira-data-manager (include context path), e.g. http://localhost:9198/data
     */
    private String baseUrl = "http://localhost:9198/data";

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
}
