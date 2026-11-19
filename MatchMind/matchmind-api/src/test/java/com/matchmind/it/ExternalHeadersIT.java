package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** One shared API key; the caller names its provider and model in headers and both are created on first use. */
class ExternalHeadersIT extends IntegrationTestBase {

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static String withoutBodyModel(String body, String model) {
        String ref = "\"model\": {\"name\": \"%s\", \"version\": \"1.0\"},".formatted(model);
        assertThat(body).contains(ref);
        return body.replace(ref, "");
    }

    private static Map<String, String> headers(String provider, String model) {
        return Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider, "X-Model-Name", model);
    }

    private List<String> modelsOf(String code) {
        return db.queryForList("SELECT m.name || '@' || m.version FROM ai_models m JOIN providers p ON p.id = m.provider_id "
            + "WHERE p.code = ? ORDER BY 1", String.class, code);
    }

    @Test
    void rejectsBadKeyAndMissingOrInvalidProvider() throws Exception {
        String body = Payloads.livePrediction(id("e"), id("m"), "gpt-x");
        assertThat(externalWith(Map.of("X-Provider", "acme"), "predictions", body).getResponse().getStatus()).isEqualTo(401);
        assertThat(externalWith(Map.of("X-Api-Key", EXTERNAL_KEY + "x", "X-Provider", "acme"), "predictions", body)
            .getResponse().getStatus()).isEqualTo(401);

        MvcResult noProvider = externalWith(Map.of("X-Api-Key", EXTERNAL_KEY), "predictions", body);
        assertThat(noProvider.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(noProvider).get("code").asText()).isEqualTo("PROVIDER_REQUIRED");
        MvcResult badProvider = externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", "bad name!"), "predictions", body);
        assertThat(badProvider.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(badProvider).get("code").asText()).isEqualTo("INVALID_PROVIDER");

        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = 'acme'", Integer.class)).isZero();
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE request_status = 'REJECTED' "
            + "AND http_status IN (400, 401) AND provider_id IS NULL", Integer.class)).isGreaterThanOrEqualTo(4);
    }

    @Test
    void headerModelIsCreatedOnFirstUseAndWinsOverTheBody() throws Exception {
        String provider = "Agent-" + UUID.randomUUID().toString().substring(0, 6); // stored lower-cased
        String code = provider.toLowerCase();
        Map<String, String> versioned = Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider,
            "X-Model-Name", "gpt-5.1", "X-Model-Version", "2025-11");
        assertThat(externalWith(versioned, "predictions", Payloads.livePrediction(id("e"), id("m"), "body-model"))
            .getResponse().getStatus()).isEqualTo(201);
        assertThat(modelsOf(code)).containsExactly("gpt-5.1@2025-11");

        // Same model again is reused; a header without a version defaults to "1".
        externalWith(versioned, "predictions", Payloads.livePrediction(id("e"), id("m"), "body-model"));
        externalWith(headers(code, "claude"), "predictions", Payloads.livePrediction(id("e"), id("m"), "body-model"));
        assertThat(modelsOf(code)).containsExactly("claude@1", "gpt-5.1@2025-11");
        assertThat(db.queryForObject("SELECT count(*) FROM predictions p JOIN providers pv ON pv.id = p.provider_id WHERE pv.code = ?",
            Integer.class, code)).isEqualTo(3);
    }

    @Test
    void modelComesFromTheBodyWithoutHeaderAndIsRequiredSomewhere() throws Exception {
        Integration in = newIntegration("from-body");
        assertThat(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), id("m"), in.modelName()))
            .getResponse().getStatus()).isEqualTo(201);
        assertThat(modelsOf(in.provider())).containsExactly("from-body@1.0");

        String noModel = withoutBodyModel(Payloads.livePrediction(id("e"), id("m"), in.modelName()), in.modelName());
        MvcResult missing = external(in.provider(), "predictions", noModel);
        assertThat(missing.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(missing).get("code").asText()).isEqualTo("MODEL_REQUIRED");
        assertThat(externalWith(headers(in.provider(), "header-only"), "predictions", noModel).getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void concurrentFirstCallsCreateOneProviderAndOneModel() throws Exception {
        String code = "race-" + UUID.randomUUID().toString().substring(0, 6);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                calls.add(() -> externalWith(headers(code, "racer"), "predictions",
                    Payloads.livePrediction(id("e"), id("m"), "ignored")).getResponse().getStatus());
            }
            for (Future<Integer> f : pool.invokeAll(calls)) assertThat(f.get()).isEqualTo(201);
        } finally {
            pool.shutdown();
        }
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Integer.class, code)).isEqualTo(1);
        assertThat(modelsOf(code)).containsExactly("racer@1");
    }

    @Test
    void defaultPromptsTellAgentsToSendProviderAndModelAsHeaders() {
        String prediction = db.queryForObject("SELECT content FROM prompt_templates WHERE template_type = 'AI_PREDICTION'", String.class);
        assertThat(prediction).contains("X-Api-Key", "X-Provider", "X-Model-Name", "X-Model-Version",
            "POST https://match.kira.id.vn/api/v1/external/predictions").doesNotContain("\"model\": {");
        String settle = db.queryForObject("SELECT content FROM prompt_templates WHERE template_type = 'AI_SETTLEMENT'", String.class);
        assertThat(settle).contains("X-Api-Key", "X-Provider", "POST https://match.kira.id.vn/api/v1/external/predictions/settle");
    }

    @Test
    void providersAndModelsCannotBeCreatedByHand() throws Exception {
        assertThat(mvc.perform(asAdmin(post("/api/v1/providers")).contentType("application/json")
            .content("{\"code\":\"x\",\"name\":\"x\"}")).andReturn().getResponse().getStatus()).isEqualTo(405);
        assertThat(mvc.perform(asAdmin(post("/api/v1/models")).contentType("application/json")
            .content("{}")).andReturn().getResponse().getStatus()).isEqualTo(405);
    }
}
