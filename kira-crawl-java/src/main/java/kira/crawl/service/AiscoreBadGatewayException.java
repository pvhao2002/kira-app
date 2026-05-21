package kira.crawl.service;

import java.util.Map;

public class AiscoreBadGatewayException extends RuntimeException {

    private final Map<String, Object> details;

    public AiscoreBadGatewayException(String message, Map<String, Object> details) {
        super(message);
        this.details = details;
    }

    public AiscoreBadGatewayException(String message) {
        this(message, Map.of());
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
