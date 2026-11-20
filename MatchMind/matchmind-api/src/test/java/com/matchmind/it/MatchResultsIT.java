package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Match results: time rules, alternative match ids, admin entry, review of corrected results, admin audit. */
class MatchResultsIT extends IntegrationTestBase {
    private static final String TWO_ONE = "{\"home\":2,\"away\":1}";

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String matchUuid(String externalMatchId) {
        return db.queryForObject("SELECT id::text FROM matches WHERE external_match_id = ?", String.class, externalMatchId);
    }

    private String currentResult(String pickId) {
        return db.queryForObject("SELECT result FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current", String.class, pickId);
    }

    private MvcResult adminPostRaw(String url, Object body) throws Exception {
        return mvc.perform(asAdmin(post(url)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn();
    }

    private String viewerToken() throws Exception {
        String name = "viewer-" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        return login(name, "viewer-password-1");
    }

    // ---------------------------------------------------------------- UX-063 time rules

    @Test
    void resultAtMoreThanFiveMinutesAheadIsRejected() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName()));
        MvcResult res = external(in.provider(), "matches/results",
            Payloads.result(matchId, "FINISHED", TWO_ONE, null, Instant.now().plus(1, ChronoUnit.HOURS).toString()));
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("code").asText()).isEqualTo("VALIDATION_ERROR");
        assertThat(read(res).get("fieldErrors").get("resultAt").asText()).contains("5 minutes");

        // A small clock skew is fine.
        MvcResult skew = external(in.provider(), "matches/results",
            Payloads.result(matchId, "FINISHED", TWO_ONE, null, Instant.now().plus(2, ChronoUnit.MINUTES).toString()));
        assertThat(skew.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void aStoredFutureResultTimeDoesNotBlockLaterResults() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName()));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":3,\"away\":0}", null, "2026-11-10T21:40:00Z"));
        // Stored before the rule existed (an agent sent 2036).
        db.update("UPDATE matches SET result_updated_at = '2036-11-19T13:00:00Z' WHERE external_match_id = ?", matchId);

        MvcResult fixed = external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":0,\"away\":0}", null, Instant.now().toString()));
        assertThat(fixed.getResponse().getStatus()).as(fixed.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(read(fixed).get("changed").asBoolean()).isTrue();
    }

    @Test
    void finishedBeforeKickOffIsRejected() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        String tomorrow = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString();
        external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), matchId, in.modelName(), "HOME")
            .replace("2026-11-11T20:00:00Z", tomorrow).replace("2026-11-11T18:00:00Z", Instant.now().toString()));
        MvcResult res = external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", TWO_ONE, null, Instant.now().toString()));
        assertThat(res.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(res).get("code").asText()).isEqualTo("MATCH_NOT_STARTED");
        // Postponing a match that has not started is fine.
        assertThat(external(in.provider(), "matches/results", Payloads.result(matchId, "POSTPONED", null, null, Instant.now().toString()))
            .getResponse().getStatus()).isEqualTo(200);
    }

    // ---------------------------------------------------------------- UX-103 match id alternatives

    @Test
    void resultsAndSettleAcceptThePredictionIdOrTheMatchId() throws Exception {
        Integration in = newIntegration("gpt-x");
        JsonNode pred = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), id("m"), in.modelName())));
        String predictionId = pred.get("predictionId").asText();
        String matchUuid = pred.get("matchId").asText();

        MvcResult byPrediction = external(in.provider(), "matches/results", """
            {"predictionId": "%s", "status": "FINISHED", "finalScore": %s, "resultAt": "2026-11-10T21:40:00Z"}
            """.formatted(predictionId, TWO_ONE));
        assertThat(byPrediction.getResponse().getStatus()).as(byPrediction.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(read(byPrediction).get("matchId").asText()).isEqualTo(matchUuid);
        assertThat(read(byPrediction).get("settlement").get("settled").asInt()).isEqualTo(2);

        MvcResult byMatch = external(in.provider(), "matches/results", """
            {"matchId": "%s", "status": "FINISHED", "finalScore": %s, "resultAt": "2026-11-10T21:40:00Z"}
            """.formatted(matchUuid, TWO_ONE));
        assertThat(byMatch.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(byMatch).get("changed").asBoolean()).isFalse();

        MvcResult settle = external(in.provider(), "predictions/settle", "{\"predictionId\": \"" + predictionId + "\"}");
        assertThat(settle.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(settle).get("alreadySettled").asInt()).isEqualTo(2);

        MvcResult both = external(in.provider(), "matches/results", """
            {"matchId": "%s", "externalMatchId": "x", "status": "FINISHED", "finalScore": %s, "resultAt": "2026-11-10T21:40:00Z"}
            """.formatted(matchUuid, TWO_ONE));
        assertThat(both.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(both).get("fieldErrors").has("matchId")).isTrue();
        MvcResult none = external(in.provider(), "matches/results", "{\"status\": \"LIVE\", \"resultAt\": \"2026-11-10T21:40:00Z\"}");
        assertThat(none.getResponse().getStatus()).isEqualTo(400);

        // Another provider cannot reach the match through its ids.
        Integration other = newIntegration("gpt-y");
        MvcResult foreign = external(other.provider(), "matches/results", """
            {"predictionId": "%s", "status": "FINISHED", "finalScore": %s, "resultAt": "2026-11-10T21:40:00Z"}
            """.formatted(predictionId, TWO_ONE));
        assertThat(foreign.getResponse().getStatus()).isEqualTo(404);
        assertThat(external(other.provider(), "predictions/settle", "{\"matchId\": \"" + matchUuid + "\"}").getResponse().getStatus()).isEqualTo(404);
    }

    // ---------------------------------------------------------------- UX-001 admin result entry

    @Test
    void adminEntersAResultThatSettlesAndIsAudited() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode pred = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        String ouPick = pred.get("picks").get(1).get("pickId").asText();
        String match = matchUuid(matchId);

        JsonNode res = adminPost("/api/v1/matches/" + match + "/result", Map.of("status", "FINISHED",
            "finalScore", Map.of("home", 2, "away", 1), "finalCorners", Map.of("home", 5, "away", 3),
            "halfTimeScore", Map.of("home", 1, "away", 0), "reason", "entered from the TV feed"));
        assertThat(res.get("changed").asBoolean()).isTrue();
        assertThat(res.get("status").asText()).isEqualTo("FINISHED");
        assertThat(res.get("settlement").get("settled").asInt()).isEqualTo(2);
        assertThat(currentResult(ouPick)).isEqualTo("WIN");
        assertThat(db.queryForObject("SELECT final_home_corners FROM matches WHERE id = ?::uuid", Integer.class, match)).isEqualTo(5);

        Map<String, Object> h = db.queryForMap("SELECT change_source, changed_by, new_result->>'changedBy' AS username, "
            + "new_result->>'reason' AS reason FROM match_result_history WHERE match_id = ?::uuid ORDER BY changed_at DESC LIMIT 1", UUID.fromString(match));
        assertThat(h.get("change_source")).isEqualTo("ADMIN");
        assertThat(h.get("changed_by")).isNotNull();
        assertThat(h.get("username")).isEqualTo(ADMIN);
        assertThat(h.get("reason")).isEqualTo("entered from the TV feed");

        // The admin correction is not blocked by STALE_RESULT and shows up for review.
        JsonNode corrected = adminPost("/api/v1/matches/" + match + "/result", Map.of("status", "FINISHED",
            "finalScore", Map.of("home", 1, "away", 1), "reason", "score corrected"));
        assertThat(corrected.get("settlement").get("needsReview").asInt()).isEqualTo(1);
        assertThat(currentResult(ouPick)).isEqualTo("WIN");

        MvcResult invalid = adminPostRaw("/api/v1/matches/" + match + "/result", Map.of("status", "FINISHED"));
        assertThat(invalid.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(invalid).get("fieldErrors").has("finalScore")).isTrue();
        assertThat(adminPostRaw("/api/v1/matches/" + UUID.randomUUID() + "/result", Map.of("status", "CANCELLED"))
            .getResponse().getStatus()).isEqualTo(404);

        String viewer = viewerToken();
        assertThat(mvc.perform(post("/api/v1/matches/" + match + "/result").header("Authorization", "Bearer " + viewer)
            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELLED\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    // ---------------------------------------------------------------- UX-051 review per match + recalculate all

    @Test
    void correctedMatchListsItsPicksForReviewAndRecalculatesThemAtOnce() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode first = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        JsonNode second = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        String match = matchUuid(matchId);
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", TWO_ONE, null, "2026-11-10T21:40:00Z"));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":1,\"away\":1}", null, "2026-11-10T21:50:00Z"));

        JsonNode forMatch = adminGet("/api/v1/settlements/needs-review?matchId=" + match);
        assertThat(forMatch).hasSize(2); // OU OVER 2.25 of both predictions: WIN -> HALF_LOSS
        JsonNode forPrediction = adminGet("/api/v1/settlements/needs-review?predictionId=" + first.get("predictionId").asText());
        assertThat(forPrediction).hasSize(1);
        assertThat(forPrediction.get(0).get("newResult").asText()).isEqualTo("HALF_LOSS");
        assertThat(adminGet("/api/v1/settlements/needs-review?matchId=" + UUID.randomUUID())).isEmpty();

        JsonNode recalculated = adminPost("/api/v1/settlements/matches/" + match + "/recalculate", Map.of("reason", "score corrected"));
        assertThat(recalculated).hasSize(2);
        for (JsonNode p : recalculated) assertThat(p.get("result").asText()).isEqualTo("HALF_LOSS");
        assertThat(currentResult(second.get("picks").get(1).get("pickId").asText())).isEqualTo("HALF_LOSS");
        assertThat(adminGet("/api/v1/settlements/needs-review?matchId=" + match)).isEmpty();
        assertThat(adminPostRaw("/api/v1/settlements/matches/" + match + "/recalculate", Map.of()).getResponse().getStatus()).isEqualTo(400);
    }

    // ---------------------------------------------------------------- UX-065 / UX-034 admin audit

    @Test
    void overrideNeedsAFinalResultAndReturnsTheReason() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode pred = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        String pick = pred.get("picks").get(0).get("pickId").asText();

        MvcResult early = adminPostRaw("/api/v1/settlements/picks/" + pick + "/override", Map.of("result", "WIN", "reason", "too early"));
        assertThat(early.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(early).get("code").asText()).isEqualTo("MATCH_NOT_FINAL");

        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", TWO_ONE, null, "2026-11-10T21:40:00Z"));
        JsonNode over = adminPost("/api/v1/settlements/picks/" + pick + "/override", Map.of("result", "PUSH", "reason", "void by league rule"));
        assertThat(over.get("status").asText()).isEqualTo("OVERRIDDEN");
        assertThat(over.get("reason").asText()).isEqualTo("void by league rule");
        assertThat(db.queryForObject("SELECT details->>'actedBy' FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current",
            String.class, pick)).isEqualTo(ADMIN);
    }

    @Test
    void recalculateWithAnUnchangedOutcomeStillRecordsTheReason() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode pred = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        String pick = pred.get("picks").get(1).get("pickId").asText();
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", TWO_ONE, null, "2026-11-10T21:40:00Z"));

        JsonNode same = adminPost("/api/v1/settlements/picks/" + pick + "/recalculate", Map.of("reason", "double-checked"));
        assertThat(same.get("status").asText()).isEqualTo("UNCHANGED");
        assertThat(same.get("result").asText()).isEqualTo("WIN");
        assertThat(same.get("reason").asText()).isEqualTo("double-checked");
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?::uuid", Integer.class, pick)).isEqualTo(2);
        Map<String, Object> row = db.queryForMap("SELECT result, source, reason, details->>'actedBy' AS acted FROM prediction_pick_results "
            + "WHERE pick_id = ?::uuid AND is_current", UUID.fromString(pick));
        assertThat(row).containsEntry("result", "WIN").containsEntry("source", "ADMIN_RECALCULATION")
            .containsEntry("reason", "double-checked").containsEntry("acted", ADMIN);
    }

    // ---------------------------------------------------------------- UX-119 settlement prompt input

    @Test
    void settlementInputListsTheMatchPicksWithIds() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode pred = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", TWO_ONE, null, "2026-11-10T21:40:00Z"));
        String match = matchUuid(matchId);

        String viewer = viewerToken();
        MvcResult res = mvc.perform(get("/api/v1/settlements/matches/" + match + "/prompt-input")
            .header("Authorization", "Bearer " + viewer)).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        JsonNode input = read(res);
        assertThat(input.get("matchId").asText()).isEqualTo(match);
        assertThat(input.get("externalMatchId").asText()).isEqualTo(matchId);
        assertThat(input.get("status").asText()).isEqualTo("FINISHED");
        assertThat(input.get("finalScore").get("home").asInt()).isEqualTo(2);
        assertThat(input.get("finalCorners").isNull()).isTrue();
        List<String> pickIds = new ArrayList<>();
        input.get("picks").forEach(p -> pickIds.add(p.get("pickId").asText()));
        assertThat(pickIds).containsExactlyInAnyOrder(pred.get("picks").get(0).get("pickId").asText(), pred.get("picks").get(1).get("pickId").asText());
        JsonNode ah = input.get("picks").get(0).get("market").asText().equals("AH") ? input.get("picks").get(0) : input.get("picks").get(1);
        assertThat(ah.get("line").decimalValue()).isEqualByComparingTo("-0.5");
        assertThat(ah.get("settlementBasis").asText()).isEqualTo("REMAINING_MATCH");
        assertThat(ah.get("scoreAtCapture").get("home").asInt()).isEqualTo(1);
        assertThat(ah.get("price").decimalValue()).isEqualByComparingTo("1.95");
        assertThat(ah.get("predictionId").asText()).isEqualTo(pred.get("predictionId").asText());
        assertThat(ah.get("currentResult").asText()).isEqualTo("LOSS"); // remaining 1-1 on HOME -0.5
        assertThat(adminGet("/api/v1/settlements/matches/" + match + "/prompt-input").get("picks")).hasSize(2);
    }
}
