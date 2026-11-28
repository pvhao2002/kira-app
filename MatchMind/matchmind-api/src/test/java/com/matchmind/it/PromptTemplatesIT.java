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
import static org.assertj.core.api.Assertions.within;

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

        // The examples follow SELECTION RULES: one pick inside the price window, live xG where the API takes it.
        assertThat(live.get("stats").get("extra").has("xg")).isTrue();
        for (ObjectNode example : List.of(live, pre)) {
            assertThat(example.get("picks")).hasSize(1);
            for (JsonNode pick : example.get("picks")) {
                JsonNode odds = null;
                for (JsonNode o : example.get("odds")) if (o.get("ref").asText().equals(pick.get("oddsRef").asText())) odds = o;
                double price = odds.get(pick.get("pick").asText().toLowerCase() + "Odds").asDouble();
                assertThat(price).as(pick.toString()).isGreaterThan(1.65).isLessThanOrEqualTo(1.90);
            }
        }
    }

    private String seededPromptId(String type) {
        return db.queryForObject("SELECT id::text FROM prompt_templates WHERE template_type = ? AND updated_by IS NULL "
            + "ORDER BY created_at LIMIT 1", String.class, type);
    }

    /** P(X = k) for X ~ Poisson(lambda). */
    private static double poisson(double lambda, int k) {
        double p = Math.exp(-lambda);
        for (int i = 1; i <= k; i++) p *= lambda / i;
        return p;
    }

    /** Expected return at stake 1 of AH HOME at {@code line} (quarter lines split in two halves), goals ~ Poisson. */
    private static double ahHomeReturn(double home, double away, double line, double price) {
        double[] halves = Math.abs(line * 4) % 2 == 1 ? new double[] {line - 0.25, line + 0.25} : new double[] {line};
        double r = 0;
        for (int h = 0; h <= 15; h++) {
            for (int a = 0; a <= 15; a++) {
                double result = 0;
                for (double half : halves) {
                    double margin = h - a + half;
                    result += (margin > 0 ? price - 1 : margin == 0 ? 0 : -1) / halves.length;
                }
                r += poisson(home, h) * poisson(away, a) * result;
            }
        }
        return r;
    }

    @Test
    void examplesKeepTheirPickByTheirOwnSimulation() throws Exception {
        // Agents copy the examples: each example's pick must pass the edge gate by the example's own expected goals.
        String prompt = predictionPrompt();
        for (String heading : List.of("OUTPUT JSON SCHEMA (example values)", "\nPRE_MATCH EXAMPLE (")) {
            ObjectNode example = exampleAfter(prompt, heading);
            JsonNode pick = example.get("picks").get(0), odds = null;
            for (JsonNode o : example.get("odds")) if (o.get("ref").asText().equals(pick.get("oddsRef").asText())) odds = o;
            assertThat(pick.get("market").asText() + " " + pick.get("pick").asText()).as(heading).isEqualTo("AH HOME");
            // LIVE AH is REMAINING_MATCH and PRE_MATCH starts from 0-0: either way the line applies to the simulated goals.
            JsonNode goals = example.get("simulation").get("expectedRemainingGoals");
            double price = odds.get("homeOdds").asDouble();
            double r = ahHomeReturn(goals.get("home").asDouble(), goals.get("away").asDouble(), odds.get("line").asDouble(), price);
            double q = (1 / price) / (1 / price + 1 / odds.get("awayOdds").asDouble());
            assertThat(pick.get("probability").asDouble()).as(heading).isCloseTo((1 + r) / price, within(0.01));
            assertThat(r).as(heading).isGreaterThanOrEqualTo(0.03);
            assertThat(r - (q * price - 1)).as(heading + " edge").isGreaterThanOrEqualTo(0.10);
        }
    }

    @Test
    @org.springframework.transaction.annotation.Transactional // rolled back: the test's copies never reach other tests
    void v45RewritesOnlyAPromptWithEveryAnchor() throws Exception {
        // The prompt as V45 found it, from the history the V16 trigger keeps: the version just before the first one with
        // the new rules. The first, because other ITs save over the seeded prompt and restore it as newer versions.
        String before = db.queryForObject("""
            SELECT prev.content FROM prompt_template_versions cur
            JOIN prompt_templates t ON t.id = cur.template_id
            JOIN prompt_template_versions prev ON prev.template_id = cur.template_id AND prev.version = cur.version - 1
            WHERE t.template_type = 'AI_PREDICTION' AND position('NO_PICK_NO_EDGE' IN cur.content) > 0
              AND position('NO_PICK_NO_EDGE' IN prev.content) = 0
            ORDER BY cur.created_at, cur.version LIMIT 1""", String.class);
        String edited = before.replace("WIN hoặc HALF_WIN, chia cho 1.000", "WIN or HALF_WIN, chia cho 1.000");
        assertThat(edited).isNotEqualTo(before);
        String tag = UUID.randomUUID().toString().substring(0, 8);
        String insert = "INSERT INTO prompt_templates (name, template_type, content) VALUES (?, 'AI_PREDICTION', ?) RETURNING id::text";
        String editedId = db.queryForObject(insert, String.class, "v45 edited " + tag, edited);
        String intactId = db.queryForObject(insert, String.class, "v45 intact " + tag, before);
        String v45;
        try (var in = getClass().getResourceAsStream("/db/migration/V45__prediction_edge_gated_selection_rules.sql")) {
            v45 = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }

        db.execute(v45);

        String sql = "SELECT content FROM prompt_templates WHERE id = ?::uuid";
        // One anchor gone (an admin edit): nothing changes, rather than new rules next to the old steps.
        assertThat(db.queryForObject(sql, String.class, editedId)).isEqualTo(edited);
        assertThat(db.queryForObject(sql, String.class, intactId)).contains("NO_PICK_NO_EDGE")
            .doesNotContain("WIN hoặc HALF_WIN", "PRICE FLOOR", "short reasoning summary");
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
    void predictionPromptCarriesSelectionRulesAndTodaysTrackRecord() throws Exception {
        String id = seededPromptId("AI_PREDICTION");
        // One phrase per section V45 rewrites: a replace() whose anchor does not match leaves its old text behind.
        assertThat(adminGet("/api/v1/prompts/" + id).get("content").asText())
            .contains("SELECTION RULES - BET ONLY WITH A REAL EDGE", "NO_PICK_NO_EDGE", "NO_PICK_PRICE_OUT_OF_RANGE",
                "probability = (1 + R) / price", "- OPTIONAL INDEPENDENT DATA", "then move it only for INDEPENDENT DATA",
                "điều chỉnh các con số này theo INDEPENDENT DATA", "{{TRACK_RECORD}}",
                "Whether there is a pick at all is for SELECTION RULES")
            .doesNotContain("TO WIN MORE OFTEN", "lower yours by that much", "WIN hoặc HALF_WIN", "PRICE FLOOR",
                "compute the win probability of every candidate pick", "short reasoning summary");
        String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
        assertThat(forAgent).doesNotContain("{{TRACK_RECORD}}", "lower your probabilities")
            .containsPattern("Settled picks, last 60 days|No settled picks yet");
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
        // Agents sent the same prompt at once used to read the same last row and write the same row number, so one
        // overwrote the other: they must append (Google picks the row) and check their row survived.
        assertThat(prediction)
            .contains("APPEND operation", "insertDataOption INSERT_ROWS", "never work out a row number yourself",
                "check that your row is there", "append the same row again")
            .doesNotContain("Add your row below the last filled row");
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

    private static final String GOALS_COLUMNS = "league, homeTeam, awayTeam, kickoffGmt7, provider, model, promptVersion, "
        + "ngHomeOdds, ngNoGoalOdds, ngAwayOdds, bttsYesOdds, bttsNoOdds, lambdaHome, lambdaAway, simulations, pNgHome, "
        + "pNgNoGoal, pNgAway, pBttsYes, ngPick, bttsPick, notes, firstGoal, homeScore, awayScore, resultSource, ngResult, "
        + "bttsResult, settledAt";

    @Test
    void nextGoalBttsPromptWritesOnlyTheGoalsTabInTheScriptsColumnOrder() throws Exception {
        // The script scores the GOALS tab by position and never sends it to MatchMind.
        assertThat(Files.readString(Path.of("../docs/google-sheet/MatchMind.gs")).replaceAll("\\s+", " "))
            .contains("const GOALS_COLUMNS = ['" + GOALS_COLUMNS.replace(", ", "', '") + "'];");
        String stored = adminGet("/api/v1/prompts/" + seededPromptId("AI_NEXT_GOAL_BTTS")).get("content").asText();
        assertThat(stored.replaceAll("\\s+", " ")).contains("Columns in this order: " + GOALS_COLUMNS + ".",
                "Google Sheet: {{MATCHMIND_SHEET_URL}}", "tab named GOALS", "GOALS_REPORT", "PRE_MATCH", "exactly 1000",
                "NO_BET", "QUEUED_IN_SHEET", "Never write into row 1", "{{PROMPT_VERSION}}")
            .doesNotContain("/api/v1/external", "X-Api-Key", "{{EXTERNAL_API_KEY}}", "CANNOT_CALL_API");
    }

    @Test
    void forAgentFillsThePromptVersionSoEachSheetRowSaysWhichPromptMadeIt() throws Exception {
        String id = seededPromptId("AI_NEXT_GOAL_BTTS");
        int version = adminGet("/api/v1/prompts/" + id).get("version").asInt();
        String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
        assertThat(forAgent).contains("Google Sheet: " + SHEET_URL, "promptVersion: " + version)
            .doesNotContain("{{PROMPT_VERSION}}", "{{MATCHMIND_SHEET_URL}}", EXTERNAL_KEY);
    }

    @Test
    void sheetSettlementPromptAlsoFillsInTheGoalsResults() throws Exception {
        String stored = adminGet("/api/v1/prompts/" + seededPromptId("AI_SHEET_SETTLEMENT")).get("content").asText();
        // The settlement agent writes exactly the result columns the script scores.
        assertThat(GOALS_COLUMNS).contains("firstGoal, homeScore, awayScore, resultSource");
        assertThat(stored.replaceAll("\\s+", " ")).contains("THE GOALS TAB", "firstGoal, homeScore, awayScore and resultSource",
                "HOME, AWAY, NONE", "VOID", "own goal", "tab named SETTLE",
                // Only SETTLE rows reach MatchMind; the GOALS backlog stays bounded.
                "sends each SETTLE row you fill in to MatchMind", "a row with NO_BET in both has nothing to score",
                "at most 7 days ago")
            .doesNotContain("sends each row you fill in");
    }

    @Test
    void sheetSettlementPromptListsTheSettleColumnsInTheScriptsOrder() throws Exception {
        String columns = "matchId, provider, league, homeTeam, awayTeam, kickoffGmt7, status, homeScore, awayScore, "
            + "homeCorners, awayCorners, htHomeScore, htAwayScore, source, sync";
        // syncedAt (last) is the script's own: the agent never touches it, so the prompt does not name it.
        assertThat(Files.readString(Path.of("../docs/google-sheet/MatchMind.gs")).replaceAll("\\s+", " "))
            .contains("const SETTLE_COLUMNS = ['" + columns.replace(", ", "', '") + "', 'syncedAt'];");
        String id = seededPromptId("AI_SHEET_SETTLEMENT");
        String stored = adminGet("/api/v1/prompts/" + id).get("content").asText();
        assertThat(stored.replaceAll("\\s+", " ")).contains("Columns in this order: " + columns + ".",
            "tab named SETTLE", "Never write into sync", "Never invent", "FILLED_IN_SHEET");
        String forAgent = adminGet("/api/v1/prompts/" + id + "/for-agent").get("content").asText();
        assertThat(forAgent).contains("Google Sheet: " + SHEET_URL).doesNotContain(EXTERNAL_KEY, "X-Api-Key");
    }
}
