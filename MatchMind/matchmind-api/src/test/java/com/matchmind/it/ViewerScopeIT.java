package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Viewers see matches and predictions but never which model or provider made them, and none of the admin pages. */
class ViewerScopeIT extends IntegrationTestBase {
    private static List<String> keysAnywhere(JsonNode node) {
        List<String> keys = new ArrayList<>();
        node.properties().forEach(e -> { keys.add(e.getKey()); keys.addAll(keysAnywhere(e.getValue())); });
        if (node.isArray()) node.forEach(n -> keys.addAll(keysAnywhere(n)));
        return keys;
    }

    @Test
    void viewersGetNoModelOrProviderDataAndNoAdminPages() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("scope-model");
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + suffix, "sc-" + suffix, in.modelName()));
        adminPost("/api/v1/users", Map.of("username", "scope" + suffix, "password", "viewer-password-987", "role", "VIEWER"));
        String viewer = "Bearer " + login("scope" + suffix, "viewer-password-987");

        for (String path : List.of("/api/v1/dashboard", "/api/v1/reports/model-performance", "/api/v1/models",
            "/api/v1/providers", "/api/v1/prompts")) {
            assertThat(mvc.perform(get(path).header("Authorization", viewer)).andReturn().getResponse().getStatus())
                .as(path).isEqualTo(403);
        }

        String q = "/api/v1/predictions?providerId=" + providerId(in);
        JsonNode adminRow = adminGet(q).get("data").get(0);
        assertThat(adminRow.get("modelName").asText()).isNotBlank();
        String predictionId = adminRow.get("id").asText(), matchId = adminRow.get("matchId").asText();
        for (String path : List.of(q, "/api/v1/predictions/" + predictionId, "/api/v1/matches/" + matchId,
            "/api/v1/matches?search=" + suffix)) {
            var res = mvc.perform(get(path).header("Authorization", viewer)).andReturn();
            assertThat(res.getResponse().getStatus()).as(path).isEqualTo(200);
            assertThat(keysAnywhere(read(res))).as(path).doesNotContain("model", "models", "modelId", "modelName",
                "modelKey", "modelVersion", "modelCount", "provider", "providerId", "providerName");
        }
        assertThat(keysAnywhere(adminGet("/api/v1/predictions/" + predictionId))).contains("model", "providerName");
    }
}
