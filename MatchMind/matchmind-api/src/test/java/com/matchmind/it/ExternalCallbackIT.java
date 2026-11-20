package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

class ExternalCallbackIT extends IntegrationTestBase {

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void storesFullPredictionAndIsIdempotent() throws Exception {
        Integration in = newIntegration("gpt-x");
        String eventId = id("e"), matchId = id("m");
        String body = Payloads.livePrediction(eventId, matchId, in.modelName());

        MvcResult first = external(in.provider(), "predictions", body);
        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        JsonNode created = read(first);
        String predictionId = created.get("predictionId").asText();
        assertThat(created.get("duplicate").asBoolean()).isFalse();
        assertThat(created.get("picks")).hasSize(2);

        assertThat(db.queryForObject("SELECT count(*) FROM prediction_odds WHERE prediction_id = ?::uuid", Integer.class, predictionId)).isEqualTo(3);
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_stats WHERE prediction_id = ?::uuid", Integer.class, predictionId)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT simulation_count FROM prediction_simulations WHERE prediction_id = ?::uuid", Integer.class, predictionId)).isEqualTo(1000);
        // Corner data was not sent, so nothing corner-related was invented.
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_odds WHERE prediction_id = ?::uuid AND market LIKE 'CORNER%'", Integer.class, predictionId)).isZero();
        assertThat(db.queryForObject("SELECT corners_home IS NULL FROM prediction_stats WHERE prediction_id = ?::uuid", Boolean.class, predictionId)).isTrue();
        assertThat(db.queryForObject("SELECT payload->>'eventId' FROM predictions WHERE id = ?::uuid", String.class, predictionId)).isEqualTo(eventId);

        // Same body again (keys reordered/whitespace changed are equivalent): duplicate, same id, nothing new stored.
        MvcResult retry = external(in.provider(), "predictions", body.replace("\n", " "));
        assertThat(retry.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(retry).get("predictionId").asText()).isEqualTo(predictionId);
        assertThat(read(retry).get("duplicate").asBoolean()).isTrue();
        assertThat(db.queryForObject("SELECT count(*) FROM predictions WHERE external_event_id = ?", Integer.class, eventId)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE event_id = ? AND request_status = 'DUPLICATE'", Integer.class, eventId)).isEqualTo(1);

        // Same eventId with a different body is a conflict, not an overwrite.
        MvcResult reused = external(in.provider(), "predictions", body.replace("\"probability\": 0.58", "\"probability\": 0.60"));
        assertThat(reused.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(reused).get("code").asText()).isEqualTo("EVENT_ID_REUSED");

        // A second prediction for the same match keeps the first one intact (history preserved).
        assertThat(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName()))
            .getResponse().getStatus()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT count(*) FROM predictions p JOIN matches m ON m.id = p.match_id WHERE m.external_match_id = ?",
            Integer.class, matchId)).isEqualTo(2);
    }

    @Test
    void validatesPayloads() throws Exception {
        Integration in = newIntegration("gpt-x");
        String ok = Payloads.livePrediction(id("e"), id("m"), in.modelName());

        MvcResult unknown = external(in.provider(), "predictions", ok.replace("\"matchMinute\": 55,", "\"matchMinute\": 55, \"surprise\": 1,"));
        assertThat(unknown.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(unknown).get("code").asText()).isEqualTo("UNKNOWN_FIELD");

        MvcResult noBasis = external(in.provider(), "predictions", ok.replace("\"settlementBasis\": \"REMAINING_MATCH\",", ""));
        assertThat(noBasis.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(noBasis).get("fieldErrors").has("odds[1].settlementBasis")).isTrue();

        MvcResult wrongMarket = external(in.provider(), "predictions", ok.replace(
            "{\"oddsRef\": \"ou-live\", \"market\": \"OU\"", "{\"oddsRef\": \"ah-live\", \"market\": \"OU\""));
        assertThat(wrongMarket.getResponse().getStatus()).isEqualTo(400);

        MvcResult badProbability = external(in.provider(), "predictions", ok.replace("\"probability\": 0.58", "\"probability\": 1.58"));
        assertThat(badProbability.getResponse().getStatus()).isEqualTo(400);

        MvcResult quarter = external(in.provider(), "predictions", ok.replace("\"line\": -0.5,", "\"line\": -0.3,"));
        assertThat(quarter.getResponse().getStatus()).isEqualTo(400);

        MvcResult lowerFinal = external(in.provider(), "predictions", ok.replace("\"correctScore\": {\"home\": 2, \"away\": 1",
            "\"correctScore\": {\"home\": 0, \"away\": 0"));
        assertThat(lowerFinal.getResponse().getStatus()).isEqualTo(400);

        assertThat(external(in.provider(), "predictions", "not json").getResponse().getStatus()).isEqualTo(400);
        // Nothing stored, not even the provider: only an accepted prediction creates it (UX-077).
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Integer.class, in.provider())).isZero();
    }

    @Test
    void providersCannotTouchEachOthersData() throws Exception {
        Integration a = newIntegration("shared-name");
        Integration b = newIntegration("shared-name");
        String matchId = id("m");
        assertThat(external(a.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, a.modelName()))
            .getResponse().getStatus()).isEqualTo(201);

        // B reporting a result for A's external match id finds nothing (ownership scoped by provider).
        MvcResult res = external(b.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-20T21:40:00Z"));
        assertThat(res.getResponse().getStatus()).isEqualTo(404);
        // B using the same external match id gets its own, separate match.
        assertThat(external(b.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, b.modelName()))
            .getResponse().getStatus()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT count(*) FROM matches WHERE external_match_id = ?", Integer.class, matchId)).isEqualTo(2);
        // Each prediction references its own provider's match and model (composite FKs guarantee this in the DB too).
        assertThat(db.queryForObject("""
            SELECT count(*) FROM predictions p JOIN matches m ON m.id = p.match_id JOIN ai_models am ON am.id = p.ai_model_id
            WHERE m.external_match_id = ? AND (m.provider_id <> p.provider_id OR am.provider_id <> p.provider_id)""",
            Integer.class, matchId)).isZero();
    }

    @Test
    void resultsSettleLiveAhOnRemainingGoalsAndCornersStayOptional() throws Exception {
        Integration in = newIntegration("gpt-x");
        String matchId = id("m");
        JsonNode live = read(external(in.provider(), "predictions", Payloads.livePrediction(id("e"), matchId, in.modelName())));

        // Final 2-1: live AH HOME -0.5 taken at 1-0 -> remaining 1-1 -> LOSS; OU 2.25 full match (3 goals) -> WIN.
        MvcResult res = external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-20T21:40:00Z"));
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        JsonNode settlement = read(res).get("settlement");
        assertThat(settlement.get("settled").asInt()).isEqualTo(2);
        String ahPick = live.get("picks").get(0).get("pickId").asText();
        String ouPick = live.get("picks").get(1).get("pickId").asText();
        assertThat(currentResult(ahPick)).isEqualTo("LOSS");
        assertThat(currentResult(ouPick)).isEqualTo("WIN");

        // Re-sending the identical result changes nothing and adds no history.
        MvcResult again = external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-20T21:40:00Z"));
        assertThat(read(again).get("changed").asBoolean()).isFalse();
        assertThat(db.queryForObject("SELECT count(*) FROM match_result_history h JOIN matches m ON m.id = h.match_id WHERE m.external_match_id = ?",
            Integer.class, matchId)).isEqualTo(1);
        // An older result arriving late is rejected.
        assertThat(external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":3,\"away\":1}", null, "2026-11-20T21:00:00Z"))
            .getResponse().getStatus()).isEqualTo(409);

        // Corner picks stay pending while the corner result is missing, then settle once it arrives.
        String cornerMatch = id("m");
        JsonNode pre = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), cornerMatch, in.modelName(), "HOME")));
        JsonNode noCorners = read(external(in.provider(), "matches/results", Payloads.result(cornerMatch, "FINISHED", "{\"home\":1,\"away\":0}", null, "2026-11-21T22:00:00Z")));
        assertThat(noCorners.get("settlement").get("settled").asInt()).isEqualTo(1);
        assertThat(noCorners.get("settlement").get("pending").asInt()).isEqualTo(1);
        assertThat(currentResult(pre.get("picks").get(1).get("pickId").asText())).isNull();

        external(in.provider(), "matches/results", Payloads.result(cornerMatch, "FINISHED", "{\"home\":1,\"away\":0}", "{\"home\":6,\"away\":4}", "2026-11-21T22:05:00Z"));
        assertThat(currentResult(pre.get("picks").get(0).get("pickId").asText())).isEqualTo("WIN");     // 1X2 HOME at 1-0
        assertThat(currentResult(pre.get("picks").get(1).get("pickId").asText())).isEqualTo("WIN");     // HOME -1.5 corners 6-4
    }

    @Test
    void cancelledMatchesVoidAndAiCalculationsAreAdvisoryOnly() throws Exception {
        Integration in = newIntegration("gpt-x");
        String cancelled = id("m");
        JsonNode c = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), cancelled, in.modelName(), "AWAY")));
        external(in.provider(), "matches/results", Payloads.result(cancelled, "CANCELLED", null, null, "2026-11-21T22:00:00Z"));
        assertThat(currentResult(c.get("picks").get(0).get("pickId").asText())).isEqualTo("VOID");

        String postponed = id("m");
        JsonNode p = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), postponed, in.modelName(), "AWAY")));
        external(in.provider(), "matches/results", Payloads.result(postponed, "POSTPONED", null, null, "2026-11-21T22:00:00Z"));
        assertThat(currentResult(p.get("picks").get(0).get("pickId").asText())).isNull();

        // FINISHED 2-0: 1X2 AWAY loses. The AI claims WIN: stored as advisory, the backend result stands.
        String finished = id("m");
        JsonNode f = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners(id("e"), finished, in.modelName(), "AWAY")));
        String pickId = f.get("picks").get(0).get("pickId").asText();
        db.update("UPDATE matches SET status = 'FINISHED', final_home_score = 2, final_away_score = 0, result_updated_at = now() WHERE external_match_id = ?", finished);
        MvcResult settle = external(in.provider(), "predictions/settle", """
            {"externalMatchId": "%s", "aiCalculations": [{"pickId": "%s", "result": "WIN", "explanation": "wrong on purpose"}]}
            """.formatted(finished, pickId));
        assertThat(settle.getResponse().getStatus()).isEqualTo(200);
        assertThat(currentResult(pickId)).isEqualTo("LOSS");
        assertThat(db.queryForObject("SELECT details->'aiCalculation'->>'agreesWithBackend' FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current",
            String.class, pickId)).isEqualTo("false");

        // Settling again does not create a second row (idempotent).
        external(in.provider(), "predictions/settle", "{\"externalMatchId\": \"%s\"}".formatted(finished));
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?::uuid", Integer.class, pickId)).isEqualTo(1);

        // Admin override supersedes but keeps the history.
        adminPost("/api/v1/settlements/picks/" + pickId + "/override", Map.of("result", "VOID", "reason", "Voided by bookmaker"));
        assertThat(currentResult(pickId)).isEqualTo("VOID");
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?::uuid", Integer.class, pickId)).isEqualTo(2);
        JsonNode recalculated = adminPost("/api/v1/settlements/picks/" + pickId + "/recalculate", Map.of("reason", "re-check"));
        assertThat(recalculated.get("result").asText()).isEqualTo("LOSS");
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?::uuid", Integer.class, pickId)).isEqualTo(3);

        // Another provider cannot settle a match it does not own.
        Integration other = newIntegration("other");
        assertThat(external(other.provider(), "predictions/settle", "{\"externalMatchId\": \"%s\"}".formatted(finished))
            .getResponse().getStatus()).isEqualTo(404);
    }

    private String currentResult(String pickId) {
        return db.query("SELECT result FROM prediction_pick_results WHERE pick_id = ?::uuid AND is_current",
            rs -> rs.next() ? rs.getString(1) : null, pickId);
    }
}
