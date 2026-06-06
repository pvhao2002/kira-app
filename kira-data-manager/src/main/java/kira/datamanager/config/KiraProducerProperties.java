package kira.datamanager.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.kira-producer")
public class KiraProducerProperties {

    /**
     * Base URL of kira-producer, e.g. http://localhost:2311
     */
    private String baseUrl = "http://localhost:2311";

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
}
