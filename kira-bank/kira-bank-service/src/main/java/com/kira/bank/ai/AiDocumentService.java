package com.kira.bank.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.application.AiProviderAccountService;
import com.kira.bank.ai.application.AiProviderAccountService.RuntimeCredential;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
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
    private final AiProviderAccountService providerAccounts;

    public boolean isConfigured() {
        return !providerAccounts.availableCredentials().isEmpty();
    }

    public String safeConfigurationSummary() {
        return "eligibleAccounts=" + providerAccounts.availableCredentials().size();
    }

    public AiBatchResponse analyzeBatch(List<AiInputDocument> documents) {
        List<RuntimeCredential> credentials = providerAccounts.availableCredentials();
        if (credentials.isEmpty()) {
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

        AiProviderException lastAccountFailure = null;
        for (RuntimeCredential credential : credentials) {
            try {
                String response = cloudflareAiRestClient.post()
                    .uri("/{accountId}/ai/run/" + credential.model(), credential.accountId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + credential.apiToken())
                    .body(body)
                    .retrieve()
                    .body(String.class);
                AiBatchResponse result = new AiBatchResponse(response, extractResults(response), credential.model());
                providerAccounts.markSuccess(credential.id());
                return result;
            } catch (RestClientResponseException ex) {
                ProviderFailure failure = providerFailure(ex);
                if (!failure.failover()) {
                    throw new AiProviderException("Cloudflare AI returned HTTP " + ex.getStatusCode().value(), ex);
                }
                if (failure.blocked()) providerAccounts.markBlocked(credential.id(), failure.code());
                else providerAccounts.markCooldown(credential.id(), failure.cooldownUntil(), failure.code());
                lastAccountFailure = new AiProviderException(
                    "Cloudflare AI account unavailable (" + failure.code() + ")", ex);
            } catch (AiProviderException ex) {
                throw ex;
            } catch (RuntimeException ex) {
                throw new AiProviderException("Cloudflare AI request failed", ex);
            }
        }
        throw new AiProviderException("No Cloudflare AI account is currently available", lastAccountFailure);
    }

    ProviderFailure providerFailure(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String internalCode = cloudflareErrorCode(ex.getResponseBodyAsString());
        String code = internalCode == null ? "HTTP_" + status : "CF_" + internalCode;
        if (status == 401 || status == 403) return new ProviderFailure(true, true, null, code);
        if (status == 429 && "3036".equals(internalCode)) {
            Instant reset = LocalDate.now(ZoneOffset.UTC).plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            return new ProviderFailure(true, false, reset.plusSeconds(5), code);
        }
        if (status == 429 && !"3040".equals(internalCode)) {
            return new ProviderFailure(true, false, retryAfter(ex), code);
        }
        return new ProviderFailure(false, false, null, code);
    }

    private String cloudflareErrorCode(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode code = objectMapper.readTree(body).path("errors").path(0).path("code");
            return code.isMissingNode() || code.isNull() ? null : code.asText();
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private Instant retryAfter(RestClientResponseException ex) {
        String value = ex.getResponseHeaders() == null ? null : ex.getResponseHeaders().getFirst(HttpHeaders.RETRY_AFTER);
        if (value != null) {
            try {
                return Instant.now().plusSeconds(Math.max(1, Long.parseLong(value.trim())));
            } catch (NumberFormatException ignored) {
                try {
                    return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                } catch (DateTimeException ignoredDate) {
                    // Fall through to the configured account cooldown.
                }
            }
        }
        return Instant.now().plus(config.accountRateLimitCooldown());
    }

    record ProviderFailure(boolean failover, boolean blocked, Instant cooldownUntil, String code) {
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

    public record AiBatchResponse(String rawResponse, List<AiExtraction> results, String model) {
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
