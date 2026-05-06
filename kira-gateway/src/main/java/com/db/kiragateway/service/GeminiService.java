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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
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

    public String getModel() {
        return geminiProperties.getModel();
    }

    public BlogGenerationResult generateBlog(String topic, String tone, String targetAudience, Integer minWords, Integer maxWords) {
        var normalizedTopic = topic == null ? "" : topic.trim();
        var variant = pickLayoutVariant(normalizedTopic);
        var prompt = buildBlogPrompt(normalizedTopic, tone, targetAudience, minWords, maxWords, variant);
        var response = generateText(prompt);
        var rawResponse = extractTextFromGeminiResponse(response);
        var parsed = parseBlogPayload(rawResponse);
        var html = sanitizeHtml(parsed.htmlContent());
        var title = parsed.title().isBlank() ? normalizedTopic : parsed.title();
        return new BlogGenerationResult(
                geminiProperties.getModel(),
                prompt,
                rawResponse == null ? "" : rawResponse,
                title,
                parsed.excerpt(),
                parsed.tags(),
                html,
                variant,
                sha256Hex(prompt)
        );
    }

    private Map<String, Object> generateText(String prompt) {
        var payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt)
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
            log.warning("generateText upstream failure: %s".formatted(ex.getMessage()));
            throw new GeminiUpstreamException(status, Map.of("message", message), ex);
        }
    }

    private BlogParsedPayload parseBlogPayload(String rawText) {
        var normalized = stripCodeFence(rawText == null ? "" : rawText);
        var jsonText = extractFirstJsonObject(normalized);
        if (jsonText == null) {
            return new BlogParsedPayload("", "", List.of(), normalized);
        }

        try {
            var node = objectMapper.readTree(jsonText);
            var title = node.path("title").asText("");
            var excerpt = node.path("excerpt").asText("");
            var htmlContent = node.path("htmlContent").asText("");
            var tagsNode = node.path("tags");
            List<String> tags = List.of();
            if (tagsNode.isArray()) {
                tags = java.util.stream.StreamSupport.stream(tagsNode.spliterator(), false)
                        .map(item -> item.asText("").trim())
                        .filter(tag -> !tag.isBlank())
                        .limit(10)
                        .toList();
            }
            return new BlogParsedPayload(title.trim(), excerpt.trim(), tags, htmlContent.trim());
        } catch (Exception ex) {
            log.warning("Failed to parse Gemini blog JSON payload: %s".formatted(ex.getMessage()));
            return new BlogParsedPayload("", "", List.of(), normalized);
        }
    }

    private static String pickLayoutVariant(String topic) {
        var variants = List.of("feature-split", "editorial-grid", "timeline-story", "qa-focus");
        var seed = ((long) topic.hashCode() << 32) ^ (System.currentTimeMillis() / 1000L);
        return variants.get(new Random(seed).nextInt(variants.size()));
    }

    private static String buildBlogPrompt(
            String topic,
            String tone,
            String targetAudience,
            Integer minWords,
            Integer maxWords,
            String variant
    ) {
        var effectiveTone = (tone == null || tone.isBlank()) ? "professional and engaging" : tone.trim();
        var effectiveAudience = (targetAudience == null || targetAudience.isBlank()) ? "general readers" : targetAudience.trim();
        var min = minWords == null ? 700 : minWords;
        var max = maxWords == null ? 1200 : maxWords;
        var safeMin = Math.max(300, Math.min(min, 5000));
        var safeMax = Math.max(safeMin, Math.min(max, 5000));
        return """
                You are a senior Vietnamese tech/blog writer and HTML formatter.
                Generate one complete blog post in Vietnamese for topic: "%s".
                
                Constraints:
                - Tone: %s
                - Target audience: %s
                - Word count: %d to %d words
                - Layout variant: %s (must differ structurally from other variants while still readable)
                
                Output format rules (STRICT):
                - Return ONLY one JSON object.
                - Do not wrap in markdown, no code fence.
                - JSON schema:
                  {
                    "title": "string",
                    "excerpt": "string <= 280 chars",
                    "tags": ["string", "... up to 8 items"],
                    "htmlContent": "string"
                  }
                
                HTML requirements for htmlContent:
                - Valid HTML fragment with exactly one root <article>.
                - Compatible with kira-ui dark theme using Tailwind utility classes:
                  - outer layout classes should include: max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8
                  - content card classes should include: rounded-2xl bg-[#1e293b] border border-slate-700 overflow-hidden shadow-xl
                  - text classes should use white/slate shades similar to: text-white, text-slate-300, text-slate-400, leading-relaxed
                - Include at least: hero section, intro, 3+ body sections, list section, quote/callout section, FAQ section, and conclusion.
                - Use semantic tags: article, header, section, h1/h2/h3, p, ul/ol, blockquote.
                - No script/style/iframe/form tags.
                - No inline JavaScript handlers.
                
                Ensure content is informative, coherent, and production-ready for direct rendering.
                """.formatted(topic, effectiveTone, effectiveAudience, safeMin, safeMax, variant);
    }

    private static String sanitizeHtml(String html) {
        if (html == null) {
            return "";
        }
        var sanitized = html
                .replaceAll("(?is)<script.*?>.*?</script>", "")
                .replaceAll("(?is)<style.*?>.*?</style>", "")
                .replaceAll("(?is)<iframe.*?>.*?</iframe>", "");
        return sanitized.trim();
    }

    private static String extractFirstJsonObject(String text) {
        if (text == null) {
            return null;
        }
        var start = text.indexOf('{');
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
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    private static String sha256Hex(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            var bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            var sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash prompt", ex);
        }
    }

    private record BlogParsedPayload(String title, String excerpt, List<String> tags, String htmlContent) {
    }

    public record BlogGenerationResult(
            String model,
            String prompt,
            String rawResponse,
            String title,
            String excerpt,
            List<String> tags,
            String htmlContent,
            String layoutVariant,
            String sourcePromptHash
    ) {
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
