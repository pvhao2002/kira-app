package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The default prediction prompt must describe both match states, and its examples must pass the real API. */
class PromptTemplatesIT extends IntegrationTestBase {

    private String predictionPrompt() {
        return db.queryForObject("SELECT content FROM prompt_templates WHERE template_type = 'AI_PREDICTION'", String.class);
    }

    /** The first JSON object after {@code heading}; Jackson stops at the end of that object. */
    private ObjectNode exampleAfter(String prompt, String heading) throws Exception {
        int at = prompt.indexOf(heading);
        assertThat(at).as("prompt has a section '%s'", heading).isNotNegative();
        return (ObjectNode) json.readTree(prompt.substring(prompt.indexOf('{', at)));
    }

    /** Sent exactly as the prompt shows it: no ids, as an agent reading a screenshot would send it. */
    private MvcResult send(ObjectNode example) throws Exception {
        String provider = "prompt-check-" + UUID.randomUUID().toString().substring(0, 8);
        return externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider, "X-Model-Name", "example"),
            "predictions", json.writeValueAsString(example));
    }

    @Test
    void predictionPromptMakesTheAgentWorkOutTheKickOffTimeInGmtPlus7() {
        String prompt = predictionPrompt();
        assertThat(prompt).contains("KICK-OFF TIME (match.startTime)", "GMT+7", "status bar",
                "minus 7 hours", "add 15 minutes for the half-time break")
            .doesNotContain("Leave out \"match.startTime\" when the kick-off time is not shown");
    }

    @Test
    void preMatchSectionExplainsWhatIsMissingBeforeKickOff() {
        String prompt = predictionPrompt();
        assertThat(prompt).contains("QUY TẮC RIÊNG CHO LIVE", "QUY TẮC RIÊNG CHO PRE_MATCH", "\"predictionType\": \"PRE_MATCH\"",
            "Không gửi snapshot odds có stage \"LIVE\"", "\"minutesRemaining\": 90");
        // LIVE rules, then PRE_MATCH rules, then the shared settlement section.
        assertThat(prompt.indexOf("QUY TẮC RIÊNG CHO LIVE")).isLessThan(prompt.indexOf("QUY TẮC RIÊNG CHO PRE_MATCH"));
        assertThat(prompt.indexOf("QUY TẮC RIÊNG CHO PRE_MATCH")).isLessThan(prompt.indexOf("SETTLEMENT BASIS - CRITICAL"));
    }

    @Test
    void bothPromptExamplesAreAcceptedByTheApi() throws Exception {
        String prompt = predictionPrompt();
        ObjectNode live = exampleAfter(prompt, "OUTPUT JSON SCHEMA (example values)");
        assertThat(live.get("predictionType").asText()).isEqualTo("LIVE");
        MvcResult liveRes = send(live);
        assertThat(liveRes.getResponse().getStatus()).as(liveRes.getResponse().getContentAsString()).isEqualTo(201);

        assertThat(live.has("eventId") || live.has("predictedAt") || live.get("match").has("externalMatchId")
            || live.get("match").has("startTime")).as("LIVE example asks only for what a screenshot shows").isFalse();
        ObjectNode pre = exampleAfter(prompt, "\nPRE_MATCH EXAMPLE ("); // the heading line, not the "see ..." reference
        assertThat(pre.has("eventId") || pre.has("predictedAt") || pre.get("match").has("externalMatchId")).isFalse();
        assertThat(pre.get("predictionType").asText()).isEqualTo("PRE_MATCH");
        assertThat(pre.has("matchMinute") || pre.has("currentScore") || pre.has("stats")).isFalse();
        for (JsonNode odds : pre.get("odds")) assertThat(odds.get("stage").asText()).isIn("OPENING", "PRE_MATCH");
        MvcResult preRes = send(pre);
        assertThat(preRes.getResponse().getStatus()).as(preRes.getResponse().getContentAsString()).isEqualTo(201);
    }

    private String seededPromptId(String type) {
        return db.queryForObject("SELECT id::text FROM prompt_templates WHERE template_type = ? AND updated_by IS NULL "
            + "ORDER BY created_at LIMIT 1", String.class, type);
    }

    @Test
    void adminCopyFillsInTheAgentKeyWhileTheStoredTextKeepsAPlaceholder() throws Exception {
        for (String type : List.of("AI_PREDICTION", "AI_SETTLEMENT")) {
            String id = seededPromptId(type);
            String stored = adminGet("/api/v1/prompts/" + id).get("content").asText();
            assertThat(stored).as(type).contains("X-Api-Key: {{EXTERNAL_API_KEY}}").doesNotContain(EXTERNAL_KEY);
            String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
            assertThat(forAgent).as(type).contains("X-Api-Key: " + EXTERNAL_KEY).doesNotContain("{{EXTERNAL_API_KEY}}");
        }
    }

    @Test
    void bothPromptsMakeTheAgentSendTheRequestItself() throws Exception {
        for (String type : List.of("AI_PREDICTION", "AI_SETTLEMENT")) {
            String prompt = adminGet("/api/v1/prompts/" + seededPromptId(type)).get("content").asText();
            assertThat(prompt).as(type)
                .contains("SEND IT TO THE API YOURSELF", "Writing the JSON in the chat is not delivery", "CANNOT_CALL_API")
                .doesNotContain("JSON only");
        }
        String prediction = predictionPrompt();
        assertThat(prediction).contains("MISSING DATA IS NEVER A REASON NOT TO SEND").doesNotContain("\"eventId\" must be unique");
        // Sandboxed agents print the body for MatchMind > Import prediction instead of a curl command.
        assertThat(prediction).contains("Import prediction", "X-Model-Name: <your model name>").doesNotContain("ready-to-run curl command");
        assertThat(prediction.indexOf("DELIVERY - MANDATORY")).isLessThan(prediction.indexOf("INPUT YOU WILL RECEIVE"));
    }

    @Test
    void artifactPromptHoldsTheWholeOutboxPage() throws Exception {
        assertThat(db.queryForObject("SELECT count(*) FROM prompt_templates WHERE template_type = 'AI_ARTIFACT'", Integer.class)).isEqualTo(1);
        String id = seededPromptId("AI_ARTIFACT");
        JsonNode stored = adminGet("/api/v1/prompts/" + id);
        assertThat(stored.get("name").asText()).isEqualTo("MatchMind Artifact Prompt");
        String page = stored.get("content").asText();
        assertThat(page).contains("<!DOCTYPE html>", "const QUEUE = [", "const API_BASE = \"{{API_BASE_URL}}\";",
            "/api/v1/external/ping", "Send all", "Test connection", "Copy JSON", "QUEUED_IN_ARTIFACT", "Do not publish");
        // Self-contained: chat sandboxes block other files and storage.
        assertThat(page).doesNotContain("<script src", "<link", "@import", "localStorage", "sessionStorage", "http://");
        // One placeholder only: the copy for agents replaces every occurrence, so the page must not compare against it.
        assertThat(StringUtils.countOccurrencesOf(page, "{{EXTERNAL_API_KEY}}")).isEqualTo(1);
        assertThat(page).contains("const API_KEY = \"{{EXTERNAL_API_KEY}}\";").doesNotContain(EXTERNAL_KEY);
        String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
        assertThat(forAgent).contains("const API_KEY = \"" + EXTERNAL_KEY + "\";").doesNotContain("{{EXTERNAL_API_KEY}}");
    }

    @Test
    void artifactCopyKeepsTheHeadersThatImportPredictionReads() throws Exception {
        String page = adminGet("/api/v1/prompts/" + seededPromptId("AI_ARTIFACT")).get("content").asText();
        // Import prediction reads the model from an "X-Model-Name:" line and the JSON from the first "{": Copy JSON puts
        // each queued header on its own line before the body, so the user also sees which provider to import under.
        assertThat(page).contains("return k + \": \" + headers[k];", ".concat(bodyText(QUEUE[i], 2)).join(\"\\n\")");
    }

    @Test
    void bothPromptsQueueFailedRequestsInTheMatchMindArtifact() throws Exception {
        Map<String, String> paths = Map.of("AI_PREDICTION", "\"path\": \"/api/v1/external/predictions\"",
            "AI_SETTLEMENT", "\"path\": \"/api/v1/external/predictions/settle\"");
        for (Map.Entry<String, String> e : paths.entrySet()) {
            String prompt = adminGet("/api/v1/prompts/" + seededPromptId(e.getKey())).get("content").asText();
            assertThat(prompt).as(e.getKey()).contains("MatchMind artifact", "\"MatchMind Artifact Prompt\"", e.getValue(),
                "QUEUED_IN_ARTIFACT", "CANNOT_CALL_API");
            // The artifact first; CANNOT_CALL_API only for agents that cannot create artifacts.
            assertThat(prompt.indexOf("MatchMind artifact")).as(e.getKey()).isLessThan(prompt.indexOf("CANNOT_CALL_API"));
        }
    }

    @Test
    void bothPromptsTryTheGoogleSheetBeforeTheArtifact() throws Exception {
        String columns = "label, path, provider, model, modelVersion, body, status";
        // The sheet script reads the columns by position, so the prompts must list them in the script's order.
        assertThat(Files.readString(Path.of("../docs/google-sheet/MatchMind.gs")))
            .contains("const COLUMNS = ['" + columns.replace(", ", "', '") + "'];");
        Map<String, String> paths = Map.of("AI_PREDICTION", "path: /api/v1/external/predictions\n",
            "AI_SETTLEMENT", "path: /api/v1/external/predictions/settle\n");
        for (Map.Entry<String, String> e : paths.entrySet()) {
            String id = seededPromptId(e.getKey());
            String stored = adminGet("/api/v1/prompts/" + id).get("content").asText();
            assertThat(stored).as(e.getKey()).contains("Google Sheet: {{MATCHMIND_SHEET_URL}}",
                "Columns in this order: " + columns + ".", e.getValue(), "QUEUED_IN_SHEET").doesNotContain(SHEET_URL);
            assertThat(stored.indexOf("Google Sheet: ")).as(e.getKey()).isLessThan(stored.indexOf("MatchMind artifact"));
            String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
            assertThat(forAgent).as(e.getKey()).contains("Google Sheet: " + SHEET_URL).doesNotContain("{{MATCHMIND_SHEET_URL}}");
        }
    }
}
