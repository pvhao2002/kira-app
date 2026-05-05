package com.db.kiragateway.service;

import com.db.kiragateway.config.GeminiProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

@Service
public class GeminiService {

    private static final Logger log = Logger.getLogger(GeminiService.class.getName());

    private final RestClient geminiRestClient;
    private final GeminiProperties geminiProperties;
    private final ObjectMapper objectMapper;

    public GeminiService(
            @Qualifier("geminiRestClient") RestClient geminiRestClient,
            GeminiProperties geminiProperties,
            ObjectMapper objectMapper
    ) {
        this.geminiRestClient = geminiRestClient;
        this.geminiProperties = geminiProperties;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> describeImage(byte[] imageBytes, String mimeType, String prompt) {
        var encodedImage = Base64.getEncoder().encodeToString(imageBytes);
        var payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt),
                                        Map.of(
                                                "inline_data", Map.of(
                                                        "mime_type", mimeType,
                                                        "data", encodedImage
                                                )
                                        )
                                )
                        )
                )
        );
        try {
            Object response = geminiRestClient.post()
                    .uri("/v1beta/models/{model}:generateContent", geminiProperties.getModel())
                    .header("x-goog-api-key", geminiProperties.getApiKey())
                    .body(payload)
                    .retrieve()
                    .body(Object.class);
            log.info("describeImage response: %s".formatted(response));
            return response == null
                    ? Map.of()
                    : objectMapper.convertValue(response, new TypeReference<>() {
            });
        } catch (RestClientResponseException ex) {
            Object errBody = ex.getResponseBodyAs(Map.class);
            if (errBody == null) {
                errBody = Map.of("message", ex.getMessage());
            }
            throw new GeminiUpstreamException(ex.getStatusCode(), errBody, ex);
        } catch (ResourceAccessException ex) {
            var timeout = isTimeout(ex);
            var status = timeout ? HttpStatusCode.valueOf(504) : HttpStatusCode.valueOf(502);
            var message = timeout ? "Gemini request timed out" : "Gemini service is unavailable";
            log.warning("describeImage upstream failure: %s".formatted(ex.getMessage()));
            throw new GeminiUpstreamException(status, Map.of("message", message), ex);
        }
    }

    public List<Map<String, Object>> describeTransactions(byte[] imageBytes, String mimeType, String prompt) {
        var response = describeImage(imageBytes, mimeType, prompt);
        var text = extractTextFromGeminiResponse(response);
        if (text == null || text.isBlank()) {
            return List.of();
        }
        return parseTransactionArray(text);
    }

    public Map<String, Object> describeTransactionsResult(byte[] imageBytes, String mimeType, String prompt) {
        var response = describeImage(imageBytes, mimeType, prompt);
        var rawResponse = extractTextFromGeminiResponse(response);
        var records = (rawResponse == null || rawResponse.isBlank())
                ? List.<Map<String, Object>>of()
                : parseTransactionArray(rawResponse);

        return Map.of(
                "raw_response", rawResponse == null ? "" : rawResponse,
                "records", records
        );
    }

    private static String extractTextFromGeminiResponse(Map<String, Object> response) {
        if (response == null) {
            return null;
        }
        var candidates = response.get("candidates");
        if (!(candidates instanceof List<?> candidateList) || candidateList.isEmpty()) {
            return null;
        }
        var firstCandidate = candidateList.get(0);
        if (!(firstCandidate instanceof Map<?, ?> candidateMap)) {
            return null;
        }
        var content = candidateMap.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) {
            return null;
        }
        var parts = contentMap.get("parts");
        if (!(parts instanceof List<?> partList) || partList.isEmpty()) {
            return null;
        }
        var firstPart = partList.get(0);
        if (!(firstPart instanceof Map<?, ?> partMap)) {
            return null;
        }
        var text = partMap.get("text");
        return text instanceof String ? ((String) text).trim() : null;
    }

    private List<Map<String, Object>> parseTransactionArray(String text) {
        var normalized = stripCodeFence(text);
        var jsonArrayText = extractFirstJsonArray(normalized);
        if (jsonArrayText == null) {
            return List.of();
        }

        try {
            var parsed = objectMapper.readValue(jsonArrayText, new TypeReference<List<Map<String, Object>>>() {});
            return sanitizeTransactions(parsed);
        } catch (Exception ex) {
            log.warning("Failed to parse Gemini response to transaction array: %s".formatted(ex.getMessage()));
            return List.of();
        }
    }

    private static String stripCodeFence(String text) {
        var trimmed = text == null ? "" : text.trim();
        if (!trimmed.startsWith("```")) {
            return trimmed;
        }

        var firstNewLine = trimmed.indexOf('\n');
        if (firstNewLine < 0) {
            return trimmed;
        }

        var withoutOpeningFence = trimmed.substring(firstNewLine + 1);
        var closingFenceIndex = withoutOpeningFence.lastIndexOf("```");
        if (closingFenceIndex < 0) {
            return withoutOpeningFence.trim();
        }

        return withoutOpeningFence.substring(0, closingFenceIndex).trim();
    }

    private static String extractFirstJsonArray(String text) {
        if (text == null) {
            return null;
        }

        var start = text.indexOf('[');
        if (start < 0) {
            return null;
        }

        var depth = 0;
        var inString = false;
        var escaped = false;

        for (int i = start; i < text.length(); i++) {
            var ch = text.charAt(i);

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch == '\\') {
                    escaped = true;
                    continue;
                }
                if (ch == '"') {
                    inString = false;
                }
                continue;
            }

            if (ch == '"') {
                inString = true;
                continue;
            }

            if (ch == '[') {
                depth++;
            } else if (ch == ']') {
                depth--;
                if (depth == 0) {
                    return text.substring(start, i + 1);
                }
            }
        }

        return null;
    }

    private static List<Map<String, Object>> sanitizeTransactions(List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }

        return items.stream()
                .filter(item -> item != null)
                .map(item -> {
                    Map<String, Object> safe = new java.util.LinkedHashMap<>();
                    safe.put("datetime", item.get("datetime"));
                    safe.put("description", item.get("description"));
                    safe.put("amount", item.get("amount"));
                    var type = item.get("type");
                    if (type instanceof String typeText && isAllowedType(typeText)) {
                        safe.put("type", typeText);
                    } else {
                        safe.put("type", null);
                    }
                    return Collections.unmodifiableMap(safe);
                })
                .toList();
    }

    private static boolean isAllowedType(String value) {
        return "deposit".equals(value) || "withdrawal".equals(value) || "bonus".equals(value);
    }

    private static boolean isTimeout(Throwable throwable) {
        var current = throwable;
        while (current != null) {
            if (current instanceof SocketTimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    public static class GeminiUpstreamException extends RuntimeException {
        private final HttpStatusCode statusCode;
        private final Object responseBody;

        public GeminiUpstreamException(HttpStatusCode statusCode, Object responseBody, Throwable cause) {
            super(cause);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        public HttpStatusCode getStatusCode() {
            return statusCode;
        }

        public Object getResponseBody() {
            return responseBody;
        }
    }
}
