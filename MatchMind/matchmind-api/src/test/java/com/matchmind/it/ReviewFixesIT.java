package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Regression tests for the module review: result corrections, input rules and access checks. */
class ReviewFixesIT extends IntegrationTestBase {

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void correctedResultIsListedForReviewAndAdminCanUnsettle() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode live = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));
        String ahPick = live.get("picks").get(0).get("pickId").asText();
        String ouPick = live.get("picks").get(1).get("pickId").asText();

        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-20T21:40:00Z"));
        assertThat(currentResult(ouPick)).isEqualTo("WIN"); // OVER 2.25 with 3 goals
        assertThat(reviewPickIds()).doesNotContain(ouPick);

        // Correction to 1-1: OVER 2.25 is now a HALF_LOSS, but the stored WIN is never changed silently.
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":1,\"away\":1}", null, "2026-11-20T21:50:00Z"));
        assertThat(currentResult(ouPick)).isEqualTo("WIN");
        // Only picks whose result would now differ are listed: AH HOME -0.5 on remaining 0-1 is still a LOSS.
        assertThat(reviewPickIds()).contains(ouPick).doesNotContain(ahPick);

        JsonNode fixed = adminPost("/api/v1/settlements/picks/" + ouPick + "/recalculate", Map.of("reason", "score corrected"));
        assertThat(fixed.get("result").asText()).isEqualTo("HALF_LOSS"); // 2 goals: 2.0 pushes, 2.5 loses
        assertThat(reviewPickIds()).doesNotContain(ouPick);

        // The match is reopened (abandoned and replayed): settled picks are listed and can go back to pending.
        external(in.provider(), "matches/results", Payloads.result(matchId, "LIVE", null, null, "2026-11-20T22:00:00Z"));
        assertThat(reviewPickIds()).contains(ahPick);
        JsonNode unsettled = adminPost("/api/v1/settlements/picks/" + ahPick + "/recalculate", Map.of("reason", "match reopened"));
        assertThat(unsettled.get("status").asText()).isEqualTo("UNSETTLED");
        assertThat(currentResult(ahPick)).isEqualTo("PENDING");
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?::uuid", Integer.class, ahPick)).isEqualTo(2);

        // Once the match finishes again, the pending pick settles normally.
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":3,\"away\":0}", null, "2026-11-20T23:00:00Z"));
        assertThat(currentResult(ahPick)).isEqualTo("WIN"); // remaining 2-0 on HOME -0.5
    }

    @Test
    void oneX2OddsMustBeSettledOnTheFullMatch() throws Exception {
        Integration in = newIntegration("gpt-x");
        String body = Payloads.livePrediction(id("e"), id("m"), in.modelName()).replace(
            "\"homeOdds\": 2.10, \"drawOdds\": 3.40, \"awayOdds\": 3.50}",
            "\"homeOdds\": 2.10, \"drawOdds\": 3.40, \"awayOdds\": 3.50, \"settlementBasis\": \"REMAINING_MATCH\", \"scoreAtCapture\": {\"home\": 1, \"away\": 0}}");
        MvcResult res = external(in.provider(), "predictions", body);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("fieldErrors").has("odds[0].settlementBasis")).isTrue();
    }

    @Test
    void predictionsForAFinishedMatchAreRejected() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), matchId, in.modelName(), "HOME"));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":1,\"away\":0}", null, "2026-11-21T22:00:00Z"));

        MvcResult late = external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), matchId, in.modelName(), "HOME"));
        assertThat(late.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(late).get("code").asText()).isEqualTo("MATCH_ALREADY_FINAL");
        assertThat(db.queryForObject("SELECT count(*) FROM predictions p JOIN matches m ON m.id = p.match_id WHERE m.external_match_id = ?",
            Integer.class, matchId)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT http_status FROM external_api_requests WHERE request_status = 'REJECTED' AND provider_id = ? "
            + "ORDER BY received_at DESC LIMIT 1", Integer.class, providerId(in))).isEqualTo(409);
    }

    @Test
    void resultUpdateKeepsFieldsItLeavesOut() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), matchId, in.modelName(), "HOME"));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":1,\"away\":0}", "{\"home\":6,\"away\":4}", "2026-11-21T22:00:00Z"));

        MvcResult res = external(in.provider(), "matches/results", """
            {"externalMatchId": "%s", "status": "FINISHED", "finalScore": {"home":1,"away":0},
             "halfTimeScore": {"home":0,"away":0}, "resultAt": "2026-11-21T22:10:00Z"}
            """.formatted(matchId));
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        assertThat(db.queryForObject("SELECT final_home_corners FROM matches WHERE external_match_id = ?", Integer.class, matchId)).isEqualTo(6);
        assertThat(db.queryForObject("SELECT ht_home_score FROM matches WHERE external_match_id = ?", Integer.class, matchId)).isZero();

        // A kept half-time score must still fit the new final score.
        MvcResult lower = external(in.provider(), "matches/results", """
            {"externalMatchId": "%s", "status": "FINISHED", "finalScore": {"home":0,"away":0},
             "halfTimeScore": {"home":1,"away":0}, "resultAt": "2026-11-21T22:20:00Z"}
            """.formatted(matchId));
        assertThat(lower.getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void adminSettlementIsRecordedAsSuch() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode pre = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), matchId, in.modelName(), "HOME")));
        db.update("UPDATE matches SET status = 'FINISHED', final_home_score = 1, final_away_score = 0, result_updated_at = now() WHERE external_match_id = ?", matchId);
        String dbMatchId = db.queryForObject("SELECT id::text FROM matches WHERE external_match_id = ?", String.class, matchId);
        adminPost("/api/v1/settlements/matches/" + dbMatchId, Map.of());
        assertThat(db.queryForObject("SELECT source FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current",
            String.class, pre.get("picks").get(0).get("pickId").asText())).isEqualTo("ADMIN_SETTLEMENT");
    }

    @Test
    void viewerCannotListUsers() throws Exception {
        adminPost("/api/v1/users", Map.of("username", "viewer-" + UUID.randomUUID().toString().substring(0, 6),
            "password", "viewer-password-1", "role", "VIEWER"));
        String name = db.queryForObject("SELECT username FROM users WHERE role = 'VIEWER' ORDER BY created_at DESC LIMIT 1", String.class);
        String viewer = login(name, "viewer-password-1");
        assertThat(mvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + viewer)).andReturn()
            .getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void passwordsLongerThan72BytesGetAFieldError() throws Exception {
        String password = "mật-khẩu-đường-dài-".repeat(3); // 57 characters, 87 UTF-8 bytes
        MvcResult res = mvc.perform(asAdmin(post("/api/v1/users")).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", "longpw" + UUID.randomUUID().toString().substring(0, 6),
                "password", password, "role", "VIEWER")))).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("fieldErrors").has("password")).isTrue();

        // Login with an over-long password is just a failed login, not a server error.
        MvcResult login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", ADMIN, "password", password)))).andReturn();
        assertThat(login.getResponse().getStatus()).isEqualTo(401);
    }

    private java.util.List<String> reviewPickIds() throws Exception {
        java.util.List<String> ids = new java.util.ArrayList<>();
        adminGet("/api/v1/settlements/needs-review").forEach(n -> ids.add(n.get("pickId").asText()));
        return ids;
    }

    private String currentResult(String pickId) {
        return db.query("SELECT result FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current",
            rs -> rs.next() ? rs.getString(1) : null, pickId);
    }
}
