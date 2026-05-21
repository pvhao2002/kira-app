package kira.crawl.web;

import java.util.Map;

public record ErrorResponse(String message, Map<String, Object> details) {
}
