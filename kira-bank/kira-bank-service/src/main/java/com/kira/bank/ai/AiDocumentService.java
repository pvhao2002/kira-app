package com.kira.bank.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
        Combine a visible page date with each row time and return ISO-8601 with an offset. Set externalTransactionId to
        any reference/order number printed for the row (e.g. "No. 5300286939", "N-5300286939"), digits only, as a string.
        Use null for unreadable fields and add a short validation warning. Return one result for every attachmentId.
        """;

    private static final String CARD_STATEMENT_PROMPT = """
        Read one credit card statement split across the labeled pages. Never invent values; use null when a value is
        not printed or unreadable and add a short validation warning. Dates are ISO-8601 (yyyy-MM-dd); Vietnamese
        statements print dd/MM/yyyy. Amounts are positive numbers without thousands separators; the printed sign or
        column only decides transactionType: SPENDING for purchases/cash advances, REFUND for reversals/credits,
        FEE for fees, INTEREST for interest, CASHBACK for cashback/rewards credited, PAYMENT for card payments.
        statementBalance is the total amount due, minimumPayment the minimum amount due. Set mccCode only when a
        4-digit MCC is printed for the row. suggestedCategory must be exactly one of the allowed values or null.
        cardLastFour is the last four digits of the masked card number. Return every transaction row on every page.
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
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", "Extract all transaction rows from every labeled image."));
        for (AiInputDocument document : documents) {
            content.add(Map.of("type", "text", "text", "attachmentId: " + document.attachmentId()));
            content.add(imageContent(document));
        }
        Invocation invocation = invoke(SYSTEM_PROMPT, content, responseSchema(), 6000);
        return new AiBatchResponse(invocation.rawResponse(), extractResults(invocation.payload()), invocation.model());
    }

    /**
     * Reads the pages of one credit-card statement. The category names are the user's own cashback groups for the
     * card so the model can suggest one per row; the result is only a draft that the user reviews before saving.
     */
    public AiCardStatementResponse analyzeCardStatement(List<AiInputDocument> pages, List<String> categoryNames) {
        List<Map<String, Object>> content = new ArrayList<>();
        String categories = categoryNames == null || categoryNames.isEmpty()
            ? "(none)" : String.join(" | ", categoryNames);
        content.add(Map.of("type", "text", "text",
            "These images are consecutive pages of ONE credit card statement. Allowed suggestedCategory values: "
                + categories));
        int page = 1;
        for (AiInputDocument document : pages) {
            content.add(Map.of("type", "text", "text", "page " + page++));
            content.add(imageContent(document));
        }
        Invocation invocation = invoke(CARD_STATEMENT_PROMPT, content, cardStatementSchema(), 8000);
        try {
            AiCardStatementExtraction extraction = invocation.payload() == null || !invocation.payload().isObject()
                ? null : objectMapper.treeToValue(invocation.payload(), AiCardStatementExtraction.class);
            if (extraction == null) {
                throw new AiProviderException("Cloudflare AI response does not contain a statement", null);
            }
            return new AiCardStatementResponse(invocation.rawResponse(), extraction, invocation.model());
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            throw new AiProviderException("Cloudflare AI returned an invalid statement payload", ex);
        }
    }

    private Map<String, Object> imageContent(AiInputDocument document) {
        String dataUri = "data:" + document.mimeType() + ";base64," + Base64.getEncoder().encodeToString(document.content());
        return Map.of("type", "image_url", "image_url", Map.of("url", dataUri));
    }

    private Invocation invoke(String systemPrompt, List<Map<String, Object>> content, Map<String, Object> schema,
                              int maxCompletionTokens) {
        List<RuntimeCredential> credentials = providerAccounts.availableCredentials();
        if (credentials.isEmpty()) {
            throw new AiProviderException("Cloudflare AI is not configured", null);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", content)
        ));
        body.put("response_format", Map.of("type", "json_schema", "json_schema", schema));
        body.put("temperature", 0);
        body.put("max_completion_tokens", maxCompletionTokens);

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
                Invocation result = new Invocation(response, extractPayload(response), credential.model());
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

    private JsonNode extractPayload(String rawResponse) {
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode resultNode = root.path("result");
            JsonNode content = resultNode.path("choices").path(0).path("message").path("content");
            return content.isTextual() ? objectMapper.readTree(content.asText()) : resultNode.path("response");
        } catch (JsonProcessingException ex) {
            throw new AiProviderException("Cloudflare AI returned invalid JSON", ex);
        }
    }

    private List<AiExtraction> extractResults(JsonNode payload) {
        try {
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

    private Map<String, Object> cardStatementSchema() {
        Map<String, Object> nullableString = Map.of("type", List.of("string", "null"));
        Map<String, Object> nullableAmount = Map.of("type", List.of("number", "null"), "minimum", 0);
        Map<String, Object> confidence = Map.of("type", List.of("number", "null"), "minimum", 0, "maximum", 1);
        Map<String, Object> strings = Map.of("type", "array", "items", Map.of("type", "string"));
        Map<String, Object> transaction = new LinkedHashMap<>();
        transaction.put("type", "object");
        transaction.put("properties", Map.ofEntries(
            Map.entry("transactionDate", nullableString),
            Map.entry("postingDate", nullableString),
            Map.entry("description", nullableString),
            Map.entry("amount", Map.of("type", List.of("number", "null"), "exclusiveMinimum", 0)),
            Map.entry("transactionType", Map.of("type", List.of("string", "null"), "enum",
                Arrays.asList("SPENDING", "REFUND", "FEE", "INTEREST", "CASHBACK", "PAYMENT", null))),
            Map.entry("mccCode", nullableString),
            Map.entry("suggestedCategory", nullableString),
            Map.entry("confidence", confidence),
            Map.entry("uncertainFields", strings)
        ));
        transaction.put("required", List.of("transactionDate", "postingDate", "description", "amount",
            "transactionType", "mccCode", "suggestedCategory", "confidence", "uncertainFields"));
        Map<String, Object> statement = new LinkedHashMap<>();
        statement.put("type", "object");
        statement.put("properties", Map.ofEntries(
            Map.entry("statementDate", nullableString),
            Map.entry("dueDate", nullableString),
            Map.entry("periodStart", nullableString),
            Map.entry("periodEnd", nullableString),
            Map.entry("openingBalance", nullableAmount),
            Map.entry("totalSpending", nullableAmount),
            Map.entry("totalRefund", nullableAmount),
            Map.entry("totalFee", nullableAmount),
            Map.entry("totalInterest", nullableAmount),
            Map.entry("statementBalance", nullableAmount),
            Map.entry("minimumPayment", nullableAmount),
            Map.entry("currency", nullableString),
            Map.entry("cardLastFour", nullableString),
            Map.entry("confidence", confidence),
            Map.entry("validationWarnings", strings),
            Map.entry("transactions", Map.of("type", "array", "items", transaction))
        ));
        statement.put("required", List.of("statementDate", "dueDate", "periodStart", "periodEnd", "openingBalance",
            "totalSpending", "totalRefund", "totalFee", "totalInterest", "statementBalance", "minimumPayment",
            "currency", "cardLastFour", "confidence", "validationWarnings", "transactions"));
        return statement;
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

    record Invocation(String rawResponse, JsonNode payload, String model) {
    }

    record ProviderFailure(boolean failover, boolean blocked, Instant cooldownUntil, String code) {
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

    public record AiCardStatementResponse(String rawResponse, AiCardStatementExtraction extraction, String model) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiCardStatementExtraction(
        String statementDate,
        String dueDate,
        String periodStart,
        String periodEnd,
        BigDecimal openingBalance,
        BigDecimal totalSpending,
        BigDecimal totalRefund,
        BigDecimal totalFee,
        BigDecimal totalInterest,
        BigDecimal statementBalance,
        BigDecimal minimumPayment,
        String currency,
        String cardLastFour,
        Double confidence,
        List<String> validationWarnings,
        List<AiCardTransactionExtraction> transactions
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiCardTransactionExtraction(
        String transactionDate,
        String postingDate,
        String description,
        BigDecimal amount,
        String transactionType,
        String mccCode,
        String suggestedCategory,
        Double confidence,
        List<String> uncertainFields
    ) {
    }

    public static class AiProviderException extends RuntimeException {
        public AiProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
