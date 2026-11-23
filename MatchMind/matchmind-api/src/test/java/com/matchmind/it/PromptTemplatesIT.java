package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

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
    void agentPromptsNeverCarryTheApiKey() throws Exception {
        // The key stays in the sheet script's properties: copies pasted into third-party chats never hold it.
        for (String type : List.of("AI_PREDICTION")) {
            String forAgent = adminGet("/api/v1/prompts/" + seededPromptId(type) + "/for-agent").get("content").asText();
            assertThat(forAgent).as(type).doesNotContain(EXTERNAL_KEY, "{{EXTERNAL_API_KEY}}", "X-Api-Key", "{{API_BASE_URL}}");
        }
    }

    @Test
    void agentPromptsMakeTheAgentAppendTheSheetRowItself() throws Exception {
        for (String type : List.of("AI_PREDICTION")) {
            String prompt = adminGet("/api/v1/prompts/" + seededPromptId(type)).get("content").asText();
            assertThat(prompt).as(type)
                .contains("DELIVERY - MANDATORY: APPEND ONE ROW TO THE GOOGLE SHEET", "Do not call any API yourself",
                    "Never write into row 1", "QUEUED_IN_SHEET", "CANNOT_CALL_API")
                .doesNotContain("JSON only", "SEND IT TO THE API YOURSELF", "MatchMind artifact", "QUEUED_IN_ARTIFACT");
            // The sheet first; CANNOT_CALL_API only when the agent cannot write to it.
            assertThat(prompt.indexOf("QUEUED_IN_SHEET")).as(type).isLessThan(prompt.indexOf("CANNOT_CALL_API"));
        }
        String prediction = predictionPrompt();
        assertThat(prediction).contains("MISSING DATA IS NEVER A REASON NOT TO SEND").doesNotContain("\"eventId\" must be unique");
        // Step 6 (English) and step 4 (Vietnamese) both settle a live REMAINING_MATCH AH from the score at capture.
        assertThat(prediction).contains("first subtract that snapshot's scoreAtCapture",
            "Never apply a REMAINING_MATCH line to the full-match score counted from 0-0", "trừ tỷ số tại thời điểm odds");
        // Agents without the sheet print the body for MatchMind > Import prediction instead of a curl command.
        assertThat(prediction).contains("Import prediction", "X-Model-Name: <your model name>").doesNotContain("ready-to-run curl command");
        assertThat(prediction.indexOf("DELIVERY - MANDATORY")).isLessThan(prediction.indexOf("INPUT YOU WILL RECEIVE"));
    }

    @Test
    void agentPromptsListTheSheetColumnsInTheScriptsOrder() throws Exception {
        String columns = "label, path, provider, model, modelVersion, body, status";
        // The sheet script reads the columns by position, so the prompts must list them in the script's order.
        assertThat(Files.readString(Path.of("../docs/google-sheet/MatchMind.gs")))
            // processedAt (last) is the script's own: agents leave it empty, so the prompts do not name it.
            .contains("const COLUMNS = ['" + columns.replace(", ", "', '") + "', 'processedAt'];");
        Map<String, String> paths = Map.of("AI_PREDICTION", "path: /api/v1/external/predictions\n");
        for (Map.Entry<String, String> e : paths.entrySet()) {
            String id = seededPromptId(e.getKey());
            String stored = adminGet("/api/v1/prompts/" + id).get("content").asText();
            assertThat(stored).as(e.getKey()).contains("Google Sheet: {{MATCHMIND_SHEET_URL}}",
                "Columns in this order: " + columns + ".", e.getValue(), "QUEUED_IN_SHEET").doesNotContain(SHEET_URL);
            String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
            assertThat(forAgent).as(e.getKey()).contains("Google Sheet: " + SHEET_URL).doesNotContain("{{MATCHMIND_SHEET_URL}}");
        }
    }

    @Test
    void sheetSettlementPromptListsTheSettleColumnsInTheScriptsOrder() throws Exception {
        String columns = "matchId, provider, league, homeTeam, awayTeam, kickoffGmt7, status, homeScore, awayScore, "
            + "homeCorners, awayCorners, htHomeScore, htAwayScore, source, sync";
        assertThat(Files.readString(Path.of("../docs/google-sheet/MatchMind.gs")).replaceAll("\\s+", " "))
            .contains("const SETTLE_COLUMNS = ['" + columns.replace(", ", "', '") + "'];");
        String id = seededPromptId("AI_SHEET_SETTLEMENT");
        String stored = adminGet("/api/v1/prompts/" + id).get("content").asText();
        assertThat(stored.replaceAll("\\s+", " ")).contains("Columns in this order: " + columns + ".",
            "tab named SETTLE", "Never write into sync", "Never invent", "FILLED_IN_SHEET");
        String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
        assertThat(forAgent).contains("Google Sheet: " + SHEET_URL).doesNotContain(EXTERNAL_KEY, "X-Api-Key");
    }
}
