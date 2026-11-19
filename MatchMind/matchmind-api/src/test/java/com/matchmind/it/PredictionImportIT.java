package com.matchmind.it;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Agents without internet (sandboxed chat tools) cannot call the API: an admin imports their JSON instead. */
class PredictionImportIT extends IntegrationTestBase {

    /** What a sandboxed agent prints: the request body without ids or clock fields. */
    private String agentJson(String home) throws Exception {
        ObjectNode p = (ObjectNode) json.readTree(Payloads.livePrediction("unused", "unused", "unused"));
        p.remove(List.of("eventId", "model", "predictedAt"));
        ((ObjectNode) p.get("match")).remove(List.of("externalMatchId", "startTime"));
        ((ObjectNode) p.get("match")).put("homeTeam", home);
        return json.writeValueAsString(p);
    }

    private MvcResult importAs(String token, String query, String body) throws Exception {
        return mvc.perform(post("/api/v1/predictions/import" + query).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
    }

    @Test
    void adminImportsWhatAnAgentPrinted() throws Exception {
        String provider = "chatgpt-" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult res = importAs(adminToken, "?provider=" + provider + "&model=gpt-x&modelVersion=5", agentJson("Imported FC"));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);

        String predictionId = read(res).get("predictionId").asText();
        Map<String, Object> row = db.queryForMap("""
            SELECT p.code, m.name, m.version FROM predictions x JOIN providers p ON p.id = x.provider_id
            JOIN ai_models m ON m.id = x.ai_model_id WHERE x.id = ?::uuid""", predictionId);
        assertThat(row).containsEntry("code", provider).containsEntry("name", "gpt-x").containsEntry("version", "5");
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE endpoint LIKE '%/predictions/import'",
            Integer.class)).isPositive();
    }

    @Test
    void importChecksTheProviderAndThePayloadLikeTheApi() throws Exception {
        MvcResult badProvider = importAs(adminToken, "?provider=Bad%20Name!&model=gpt-x", agentJson("A"));
        assertThat(badProvider.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(badProvider).get("code").asText()).isEqualTo("INVALID_PROVIDER");

        MvcResult noTeams = importAs(adminToken, "?provider=chatgpt&model=gpt-x", "{\"predictionType\":\"LIVE\"}");
        assertThat(noTeams.getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void viewerCannotImport() throws Exception {
        String name = "importer-" + UUID.randomUUID().toString().substring(0, 6);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        MvcResult res = importAs(login(name, "viewer-password-1"), "?provider=chatgpt&model=gpt-x", agentJson("V"));
        assertThat(res.getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void agentsThatCannotSetHeadersMayNameProviderAndModelInTheQuery() throws Exception {
        String provider = "gpt-action-" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult res = mvc.perform(post("/api/v1/external/predictions?provider=" + provider + "&model=gpt-action")
            .header("X-Api-Key", EXTERNAL_KEY).contentType(MediaType.APPLICATION_JSON).content(agentJson("Action FC"))).andReturn();
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Integer.class, provider)).isEqualTo(1);
    }
}
