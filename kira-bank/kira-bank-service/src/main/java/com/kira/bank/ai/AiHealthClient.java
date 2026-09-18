package com.kira.bank.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.application.AiProviderAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

/**
 * Health prompts use the configured account selection/failure policy without investment extraction.
 */
@Service
@RequiredArgsConstructor
public class AiHealthClient {
    private final AiProviderAccountService accounts;
    private final AiDocumentService policy;
    private final RestClient cloudflareAiRestClient;
    private final ObjectMapper mapper;

    public JsonNode generate(String system, Object input) {
        var credentials = accounts.availableCredentials();
        if (credentials.isEmpty()) throw new IllegalStateException("HEALTH_AI_NOT_CONFIGURED");
        for (var credential : credentials) {
            try {
                var body = Map.of("messages", List.of(Map.of("role", "system", "content", system), Map.of("role", "user", "content", mapper.writeValueAsString(input))),
                    "response_format", Map.of("type", "json_object"), "temperature", 0.2, "max_completion_tokens", 7000);
                String raw = cloudflareAiRestClient.post().uri("/{accountId}/ai/run/" + credential.model(), credential.accountId())
                    .contentType(MediaType.APPLICATION_JSON).header("Authorization", "Bearer " + credential.apiToken()).body(body).retrieve().body(String.class);
                JsonNode result = mapper.readTree(raw).path("result");
                JsonNode payload = result.path("choices").path(0).path("message").path("content");
                if (payload.isMissingNode()) payload = result.path("response");
                if (payload.isTextual()) payload = mapper.readTree(payload.asText());
                if (!payload.isObject()) throw new IllegalStateException("HEALTH_AI_INVALID_RESPONSE");
                accounts.markSuccess(credential.id());
                return payload;
            } catch (RestClientResponseException e) {
                var failure = policy.providerFailure(e);
                if (!failure.failover()) throw new IllegalStateException("HEALTH_AI_UNAVAILABLE");
                if (failure.blocked()) accounts.markBlocked(credential.id(), failure.code());
                else accounts.markCooldown(credential.id(), failure.cooldownUntil(), failure.code());
            } catch (Exception e) {
                // Do not retain provider exceptions: they can contain URLs, credentials or health prompts.
                throw new IllegalStateException("HEALTH_AI_INVALID_RESPONSE");
            }
        }
        throw new IllegalStateException("HEALTH_AI_UNAVAILABLE");
    }
}
