package com.db.kiragateway.service;

import com.db.kiragateway.config.GeminiProperties;
import com.db.kiragateway.dto.GeminiWebsiteCrawlResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    public WebsiteCrawlResult extractWebsiteEventData(String sourceUrl, String customPrompt) {
        var normalizedUrl = normalizeHttpUrl(sourceUrl);
        var prompt = buildWebsiteEventCrawlPrompt(normalizedUrl, customPrompt);
        var response = generateStructuredJson(prompt, websiteEventCrawlSchema());
        var rawResponse = extractTextFromGeminiResponse(response);
        var payload = parseWebsiteEventCrawlPayload(rawResponse);
        return new WebsiteCrawlResult(
                geminiProperties.getModel(),
                prompt,
                rawResponse == null ? "" : rawResponse,
                new GeminiWebsiteCrawlResponse.GeminiWebsiteCrawlData(
                        normalizedUrl,
                        sha256Hex(prompt),
                        rawResponse == null ? "" : rawResponse,
                        safeList(payload.events()),
                        safeList(payload.eventResults()),
                        safeList(payload.eventOdds()),
                        safeList(payload.eventOddsTimeline())
                )
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

    private Map<String, Object> generateStructuredJson(String prompt, Map<String, Object> schema) {
        var payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt)
                                )
                        )
                ),
                "tools", List.of(
                        Map.of("googleSearch", Map.of()),
                        Map.of("urlContext", Map.of())
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", schema
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
            log.warning("generateStructuredJson upstream failure: %s".formatted(ex.getMessage()));
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

    private WebsiteCrawlPayload parseWebsiteEventCrawlPayload(String rawText) {
        var normalized = stripCodeFence(rawText == null ? "" : rawText);
        var jsonText = extractFirstJsonObject(normalized);
        if (jsonText == null) {
            return WebsiteCrawlPayload.empty();
        }

        try {
            return objectMapper.readValue(jsonText, WebsiteCrawlPayload.class);
        } catch (Exception ex) {
            log.warning("Failed to parse Gemini website crawl JSON payload: %s".formatted(ex.getMessage()));
            return WebsiteCrawlPayload.empty();
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

    private static String buildWebsiteEventCrawlPrompt(String sourceUrl, String customPrompt) {
        var effectiveCustomPrompt = customPrompt == null || customPrompt.isBlank()
                ? "No additional user instruction."
                : customPrompt.trim();
        return """
                You are a data extraction engine for football/soccer event pages and betting odds pages.
                Use Google Search and URL Context tools to retrieve factual data for the provided source URL.
                The target website can be AIScore and may be a JavaScript SPA, so do not rely on caller-provided HTML.
                Search for indexed page content, structured snippets, URL context, and related public match/odds data.
                Do not invent values.
                
                Source URL:
                %s
                
                Additional user instruction:
                %s
                
                Output rules:
                - Return exactly one JSON object, no markdown, no code fence, no explanation.
                - Use camelCase field names exactly as defined by the schema.
                - Return empty arrays when no rows are found.
                - Use null when a value is missing or uncertain.
                - Dates must be ISO-like strings: "yyyy-MM-dd HH:mm:ss" when time is known, otherwise "yyyy-MM-dd".
                - `externalId` is required for row correlation. Prefer provider event id from the page; otherwise derive a stable id from source URL + home team + away team + event date.
                - `providerStatus` should be one of scheduled, live, finished, cancelled, postponed, or null.
                - `htResult` and `ftResult` must be H, D, A, or None when score data is available.
                - Odds market values must be: hdc, ou, corner.
                - Odds type values must be: open, pre-match, half-time.
                - `priceA` is home/over/first-side price. `priceB` is away/under/second-side price.
                - For child rows, include `externalId`; leave `eventId` null unless the website explicitly provides this database id.
                - Do not include generated database columns such as htTotalGoal, ftTotalGoal, htTotalCorner, or ftTotalCorner.
                - Ignore navigation, ads, unrelated links, comments, scripts, styles, tracking content, and generic SPA shell text.
                """.formatted(sourceUrl, effectiveCustomPrompt);
    }

    private static String normalizeHttpUrl(String sourceUrl) {
        if (!StringUtils.hasText(sourceUrl)) {
            throw new IllegalArgumentException("url is required");
        }
        try {
            var uri = URI.create(sourceUrl.trim());
            var scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!("http".equals(scheme) || "https".equals(scheme)) || !StringUtils.hasText(uri.getHost())) {
                throw new IllegalArgumentException("url must be an absolute http/https URL");
            }
            return uri.toString();
        } catch (IllegalArgumentException ex) {
            if (ex.getMessage() != null && ex.getMessage().startsWith("url ")) {
                throw ex;
            }
            throw new IllegalArgumentException("url is invalid", ex);
        }
    }

    private static Map<String, Object> websiteEventCrawlSchema() {
        var properties = new LinkedHashMap<String, Object>();
        properties.put("events", arraySchema(eventRowSchema()));
        properties.put("eventResults", arraySchema(eventResultRowSchema()));
        properties.put("eventOdds", arraySchema(eventOddsRowSchema()));
        properties.put("eventOddsTimeline", arraySchema(eventOddsTimelineRowSchema()));
        return objectSchema(properties, List.of("events", "eventResults", "eventOdds", "eventOddsTimeline"));
    }

    private static Map<String, Object> eventRowSchema() {
        var properties = new LinkedHashMap<String, Object>();
        for (var field : List.of(
                "externalId", "homeName", "awayName", "homeUrl", "awayUrl", "eventName", "eventDate",
                "countryName", "leagueName", "leagueUrl", "detailLink", "ftScoreStr", "htScoreStr", "providerStatus"
        )) {
            properties.put(field, nullableSchema("string"));
        }
        for (var field : List.of("ftHomeScore", "ftAwayScore", "htHomeScore", "htAwayScore", "homeCorner", "awayCorner")) {
            properties.put(field, nullableSchema("integer"));
        }
        return objectSchema(properties, List.of());
    }

    private static Map<String, Object> eventResultRowSchema() {
        var properties = new LinkedHashMap<String, Object>();
        properties.put("externalId", nullableSchema("string"));
        properties.put("eventId", nullableSchema("integer"));
        for (var field : List.of("htResult", "htGoalStr", "ftResult", "ftGoalStr")) {
            properties.put(field, nullableSchema("string"));
        }
        for (var field : List.of(
                "htHomeGoal", "htAwayGoal", "ftHomeGoal", "ftAwayGoal",
                "htHomeCorner", "htAwayCorner", "ftHomeCorner", "ftAwayCorner",
                "htHomeYellowCard", "htAwayYellowCard", "ftHomeYellowCard", "ftAwayYellowCard",
                "htHomeFoul", "htAwayFoul", "ftHomeFoul", "ftAwayFoul",
                "htHomeOffside", "htAwayOffside", "ftHomeOffside", "ftAwayOffside",
                "htHomeTotalShot", "htAwayTotalShot", "ftHomeTotalShot", "ftAwayTotalShot",
                "htHomeShotOnTarget", "htAwayShotOnTarget", "ftHomeShotOnTarget", "ftAwayShotOnTarget"
        )) {
            properties.put(field, nullableSchema("integer"));
        }
        return objectSchema(properties, List.of());
    }

    private static Map<String, Object> eventOddsRowSchema() {
        var properties = new LinkedHashMap<String, Object>();
        properties.put("externalId", nullableSchema("string"));
        properties.put("eventId", nullableSchema("integer"));
        for (var field : List.of("type", "market", "line")) {
            properties.put(field, nullableSchema("string"));
        }
        properties.put("priceA", nullableSchema("number"));
        properties.put("priceB", nullableSchema("number"));
        return objectSchema(properties, List.of());
    }

    private static Map<String, Object> eventOddsTimelineRowSchema() {
        var properties = new LinkedHashMap<String, Object>();
        properties.put("externalId", nullableSchema("string"));
        properties.put("eventId", nullableSchema("integer"));
        for (var field : List.of("market", "line", "matchMinute", "crawledAt")) {
            properties.put(field, nullableSchema("string"));
        }
        properties.put("priceA", nullableSchema("number"));
        properties.put("priceB", nullableSchema("number"));
        return objectSchema(properties, List.of());
    }

    private static Map<String, Object> objectSchema(Map<String, Object> properties, List<String> required) {
        var schema = new LinkedHashMap<String, Object>();
        schema.put("type", "object");
        schema.put("properties", properties);
        if (!required.isEmpty()) {
            schema.put("required", required);
        }
        return schema;
    }

    private static Map<String, Object> arraySchema(Map<String, Object> itemSchema) {
        var schema = new LinkedHashMap<String, Object>();
        schema.put("type", "array");
        schema.put("items", itemSchema);
        return schema;
    }

    private static Map<String, Object> nullableSchema(String type) {
        var schema = new LinkedHashMap<String, Object>();
        schema.put("type", type);
        schema.put("nullable", true);
        return schema;
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

    private static <T> List<T> safeList(List<T> items) {
        return items == null ? List.of() : items;
    }

    private record BlogParsedPayload(String title, String excerpt, List<String> tags, String htmlContent) {
    }

    private record WebsiteCrawlPayload(
            List<GeminiWebsiteCrawlResponse.EventRow> events,
            List<GeminiWebsiteCrawlResponse.EventResultRow> eventResults,
            List<GeminiWebsiteCrawlResponse.EventOddsRow> eventOdds,
            List<GeminiWebsiteCrawlResponse.EventOddsTimelineRow> eventOddsTimeline
    ) {
        private static WebsiteCrawlPayload empty() {
            return new WebsiteCrawlPayload(List.of(), List.of(), List.of(), List.of());
        }
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

    public record WebsiteCrawlResult(
            String model,
            String prompt,
            String rawResponse,
            GeminiWebsiteCrawlResponse.GeminiWebsiteCrawlData data
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
