package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Prompt history and restore, the copy for viewers, the API base URL placeholder and the default template texts. */
class PromptVersionsIT extends IntegrationTestBase {

    private String seeded(String type) {
        return db.queryForObject("SELECT id::text FROM prompt_templates WHERE template_type = ? AND updated_by IS NULL "
            + "ORDER BY created_at LIMIT 1", String.class, type);
    }

    private MvcResult putPrompt(String id, String content, int expectedVersion) throws Exception {
        return mvc.perform(asAdmin(put("/api/v1/prompts/" + id)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
            Map.of("content", content, "description", "d", "active", true, "expectedVersion", expectedVersion)))).andReturn();
    }

    // ---------------------------------------------------------------- UX-060 history and restore

    @Test
    void everySavedVersionIsKeptAndCanBeRestored() throws Exception {
        JsonNode created = adminPost("/api/v1/prompts", Map.of("name", "history-" + UUID.randomUUID().toString().substring(0, 8),
            "templateType", "TEST_HISTORY", "content", "first text"));
        String id = created.get("id").asText();
        assertThat(putPrompt(id, "second text", 1).getResponse().getStatus()).isEqualTo(200);
        assertThat(putPrompt(id, "third text", 2).getResponse().getStatus()).isEqualTo(200);

        JsonNode versions = adminGet("/api/v1/prompts/" + id + "/versions");
        assertThat(versions).hasSize(3);
        assertThat(versions.get(0).get("version").asInt()).isEqualTo(3);
        assertThat(versions.get(2).get("version").asInt()).isEqualTo(1);
        assertThat(versions.get(0).has("content")).isFalse(); // the list stays small; one version carries its text
        assertThat(versions.get(0).get("updatedByUsername").asText()).isEqualTo(ADMIN);
        assertThat(adminGet("/api/v1/prompts/" + id + "/versions/1").get("content").asText()).isEqualTo("first text");

        JsonNode restored = adminPost("/api/v1/prompts/" + id + "/versions/1/restore", Map.of("expectedVersion", 3));
        assertThat(restored.get("version").asInt()).isEqualTo(4);
        assertThat(restored.get("content").asText()).isEqualTo("first text");
        assertThat(adminGet("/api/v1/prompts/" + id + "/versions")).hasSize(4);

        MvcResult stale = mvc.perform(asAdmin(post("/api/v1/prompts/" + id + "/versions/2/restore")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedVersion\": 3}")).andReturn();
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(stale).get("code").asText()).isEqualTo("PROMPT_VERSION_CONFLICT");
        assertThat(mvc.perform(asAdmin(get("/api/v1/prompts/" + id + "/versions/99"))).andReturn().getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    void seededTemplatesHaveTheirCurrentVersionInTheHistory() throws Exception {
        for (String type : List.of("AI_PREDICTION", "AI_SETTLEMENT", "AI_ARTIFACT", "AI_MATCH_RESULT")) {
            String id = seeded(type);
            int current = adminGet("/api/v1/prompts/" + id).get("version").asInt();
            JsonNode versions = adminGet("/api/v1/prompts/" + id + "/versions");
            assertThat(versions.get(0).get("version").asInt()).as(type).isEqualTo(current);
        }
    }

    @Test
    void historyRowsCannotBeChanged() {
        String id = seeded("AI_SETTLEMENT");
        assertThat(org.assertj.core.api.Assertions.catchThrowable(() ->
            db.update("UPDATE prompt_template_versions SET content = 'x' WHERE template_id = ?::uuid", id))).isNotNull();
    }

    // ---------------------------------------------------------------- UX-060 copy for viewers

    @Test
    void viewersCopyTheTextWithoutTheKeyAndAreToldSo() throws Exception {
        String name = "copy-" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        String viewer = login(name, "viewer-password-1");
        String id = seeded("AI_PREDICTION");

        MvcResult res = mvc.perform(get("/api/v1/prompts/" + id + "/for-agent").header("Authorization", "Bearer " + viewer)).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        JsonNode copy = read(res);
        assertThat(copy.get("keyRendered").asBoolean()).isFalse();
        assertThat(copy.get("content").asText()).contains("{{EXTERNAL_API_KEY}}").doesNotContain(EXTERNAL_KEY);

        JsonNode admin = adminGet("/api/v1/prompts/" + id + "/for-agent");
        assertThat(admin.get("keyRendered").asBoolean()).isTrue();
        assertThat(admin.get("content").asText()).contains(EXTERNAL_KEY);
    }

    // ---------------------------------------------------------------- UX-067 base URL

    @Test
    void promptsNameTheApiThroughAPlaceholderFilledFromTheRequestOrigin() throws Exception {
        for (String type : List.of("AI_PREDICTION", "AI_SETTLEMENT", "AI_ARTIFACT", "AI_MATCH_RESULT")) {
            String id = seeded(type);
            assertThat(adminGet("/api/v1/prompts/" + id).get("content").asText()).as(type)
                .contains("{{API_BASE_URL}}").doesNotContain("match.kira.id.vn");
            String copy = read(mvc.perform(asAdmin(get("/api/v1/prompts/" + id + "/for-agent"))
                .header("Host", "staging.example.org").header("X-Forwarded-Proto", "https")).andReturn()).get("content").asText();
            assertThat(copy).as(type).contains("https://staging.example.org").doesNotContain("{{API_BASE_URL}}");
        }
        assertThat(adminGet("/api/v1/prompts/" + seeded("AI_PREDICTION") + "/for-agent").get("content").asText())
            .contains("POST http://localhost/api/v1/external/predictions");
    }

    // ---------------------------------------------------------------- UX-116 size limit

    @Test
    void anOverLongPromptGetsAFieldErrorNamingTheLimit() throws Exception {
        MvcResult res = putPrompt(seeded("AI_SETTLEMENT"), "x".repeat(200_001), 1);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("fieldErrors").get("content").asText()).contains("200000");
    }

    // ---------------------------------------------------------------- UX-103 / UX-106 / UX-119 / UX-067 template texts

    @Test
    void defaultTemplatesTellAgentsWhatToReportAndHowToHandleErrors() throws Exception {
        String prediction = adminGet("/api/v1/prompts/" + seeded("AI_PREDICTION")).get("content").asText();
        assertThat(prediction).contains("predictionId, matchId", "409 EVENT_ID_REUSED", "409 MATCH_ALREADY_FINAL");

        String settlement = adminGet("/api/v1/prompts/" + seeded("AI_SETTLEMENT")).get("content").asText();
        assertThat(settlement).contains("422 PICK_NOT_IN_MATCH", "FINAL_BELOW_CAPTURE_SCORE", "\"predictionId\"", "prompt-input")
            .doesNotContain("<!-- e2e");

        String result = adminGet("/api/v1/prompts/" + seeded("AI_MATCH_RESULT")).get("content").asText();
        assertThat(result).contains("{{API_BASE_URL}}/api/v1/external/matches/results", "X-Api-Key: {{EXTERNAL_API_KEY}}",
            "\"predictionId\"", "\"resultAt\"", "5 minutes", "409 STALE_RESULT", "409 MATCH_NOT_STARTED", "CANNOT_CALL_API");
    }
}
