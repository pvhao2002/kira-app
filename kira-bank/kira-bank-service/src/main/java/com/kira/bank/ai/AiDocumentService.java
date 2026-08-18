package com.kira.bank.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AiDocumentService {
    private static final String SYSTEM_PROMPT = """
        Extract every visible investment transaction from each labeled image. Never invent values.
        Keep rawText exactly as visible. Amount must be positive; use the text sign only to infer the type.
        Types are DEPOSIT, WITHDRAWAL, BONUS. Statuses are PENDING, COMPLETED, FAILED, CANCELLED.
        Combine a visible page date with each row time and return ISO-8601 with an offset. Preserve transaction IDs as strings.
        Use null for unreadable fields and add a short validation warning. Return one result for every attachmentId.
        """;

    private final AiProviderConfiguration config;
    private final RestClient cloudflareAiRestClient;
    private final ObjectMapper objectMapper;

    public boolean isConfigured() {
        return config.isConfigured();
    }

    public AiBatchResponse analyzeBatch(List<AiInputDocument> documents) {
        if (!isConfigured()) {
            throw new AiProviderException("Cloudflare AI is not configured", null);
        }
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", "Extract all transaction rows from every labeled image."));
        for (AiInputDocument document : documents) {
            content.add(Map.of("type", "text", "text", "attachmentId: " + document.attachmentId()));
            String dataUri = "data:" + document.mimeType() + ";base64," + Base64.getEncoder().encodeToString(document.content());
            content.add(Map.of("type", "image_url", "image_url", Map.of("url", dataUri)));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messages", List.of(
            Map.of("role", "system", "content", SYSTEM_PROMPT),
            Map.of("role", "user", "content", content)
        ));
        body.put("response_format", Map.of("type", "json_schema", "json_schema", responseSchema()));
        body.put("temperature", 0);
        body.put("max_completion_tokens", 6000);

        try {
            String response = cloudflareAiRestClient.post()
                .uri("/{accountId}/ai/run/" + config.model(), config.accountId())
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + config.apiToken())
                .body(body)
                .retrieve()
                .body(String.class);
            return new AiBatchResponse(response, extractResults(response));
        } catch (RestClientResponseException ex) {
            throw new AiProviderException("Cloudflare AI returned HTTP " + ex.getStatusCode().value(), ex);
        } catch (RuntimeException ex) {
            throw new AiProviderException("Cloudflare AI request failed", ex);
        }
    }

    private List<AiExtraction> extractResults(String rawResponse) {
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode resultNode = root.path("result");
            JsonNode content = resultNode.path("choices").path(0).path("message").path("content");
            JsonNode payload = content.isTextual() ? objectMapper.readTree(content.asText()) : resultNode.path("response");
            JsonNode results = payload.path("results");
            if (!results.isArray()) {
                throw new AiProviderException("Cloudflare AI response does not contain results", null);
            }
            List<AiExtraction> extracted = new ArrayList<>();
            for (JsonNode result : results) {
                extracted.add(objectMapper.treeToValue(result, AiExtraction.class));
            }
            return extracted;
        } catch (JsonProcessingException ex) {
            throw new AiProviderException("Cloudflare AI returned invalid JSON", ex);
        }
    }

    public record AiInputDocument(Long attachmentId, String mimeType, byte[] content) {
    }

    public record AiBatchResponse(String rawResponse, List<AiExtraction> results) {
    }

    public record AiExtraction(
        Long attachmentId,
        List<AiTransactionExtraction> transactions
    ) {
    }

    public record AiTransactionExtraction(
        String transactionType,
        String transactionStatus,
        BigDecimal amount,
        String currency,
        String transactionAt,
        String externalTransactionId,
        String description,
        String rawText,
        Double confidence,
        List<String> uncertainFields,
        List<String> validationWarnings
    ) {
    }

    private Map<String, Object> responseSchema() {
        Map<String, Object> nullableString = Map.of("type", List.of("string", "null"));
        Map<String, Object> transaction = new LinkedHashMap<>();
        transaction.put("type", "object");
        transaction.put("properties", Map.ofEntries(
            Map.entry("transactionType", Map.of("type", List.of("string", "null"), "enum", Arrays.asList("DEPOSIT", "WITHDRAWAL", "BONUS", null))),
            Map.entry("transactionStatus", Map.of("type", List.of("string", "null"), "enum", Arrays.asList("PENDING", "COMPLETED", "FAILED", "CANCELLED", null))),
            Map.entry("amount", Map.of("type", List.of("number", "null"), "exclusiveMinimum", 0)),
            Map.entry("currency", nullableString),
            Map.entry("transactionAt", nullableString),
            Map.entry("externalTransactionId", nullableString),
            Map.entry("description", nullableString),
            Map.entry("rawText", nullableString),
            Map.entry("confidence", Map.of("type", List.of("number", "null"), "minimum", 0, "maximum", 1)),
            Map.entry("uncertainFields", Map.of("type", "array", "items", Map.of("type", "string"))),
            Map.entry("validationWarnings", Map.of("type", "array", "items", Map.of("type", "string")))
        ));
        transaction.put("required", List.of("transactionType", "transactionStatus", "amount", "currency", "transactionAt",
            "externalTransactionId", "description", "rawText", "confidence", "uncertainFields", "validationWarnings"));
        Map<String, Object> result = Map.of(
            "type", "object",
            "properties", Map.of(
                "attachmentId", Map.of("type", "integer"),
                "transactions", Map.of("type", "array", "items", transaction)
            ),
            "required", List.of("attachmentId", "transactions")
        );
        return Map.of(
            "type", "object",
            "properties", Map.of("results", Map.of("type", "array", "items", result)),
            "required", List.of("results")
        );
    }

    public static class AiProviderException extends RuntimeException {
        public AiProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
