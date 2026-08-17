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
        You extract investment transaction details from receipt images. Return JSON only in this shape:
        {"results":[{"attachmentId":number,"type":"DEPOSIT|WITHDRAWAL|BONUS|null","amount":number|null,
        "transactionDate":"ISO-8601 timestamp|null","description":"string|null","confidence":number,
        "uncertainFields":["string"],"validationWarnings":["string"]}]}. Return exactly one item for every supplied attachmentId.
        Never invent values. Use null and add a validation warning when a field cannot be read with confidence.
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
        content.add(Map.of("type", "text", "text", "Extract one transaction draft for each labeled image."));
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
        body.put("response_format", Map.of("type", "json_object"));
        body.put("temperature", 0);
        body.put("max_tokens", 1200);

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
            JsonNode content = root.path("result").path("choices").path(0).path("message").path("content");
            if (!content.isTextual()) {
                throw new AiProviderException("Cloudflare AI returned an unexpected response", null);
            }
            JsonNode results = objectMapper.readTree(content.asText()).path("results");
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
        String type,
        BigDecimal amount,
        String transactionDate,
        String description,
        Double confidence,
        List<String> uncertainFields,
        List<String> validationWarnings
    ) {
    }

    public static class AiProviderException extends RuntimeException {
        public AiProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
