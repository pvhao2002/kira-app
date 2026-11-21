package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** UX-046 counting policy: aggregates count the latest prediction per (fixture, effective model, type, minute). */
class DuplicateCountingIT extends IntegrationTestBase {
    private static final Instant KICK_OFF = Instant.parse("2026-11-09T18:00:00Z");

    /** A fresh provider and match (unique teams, so no other test's match joins its fixture). */
    private record Case(Integration in, String matchId, String home, String away) {
        String send(String eventId) {
            return Payloads.livePrediction(eventId, matchId, in.modelName(), home, away, "League", KICK_OFF);
        }
    }

    private Case newCase() {
        String t = UUID.randomUUID().toString().substring(0, 8);
        return new Case(newIntegration("dup-model"), "dup-" + t, "Home " + t, "Away " + t);
    }

    private JsonNode post(Case c, String body) throws Exception {
        MvcResult res = external(c.in().provider(), "predictions", body);
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
        return read(res);
    }

    private void finish(Case c) throws Exception {
        // Final 2-1 after 1-0 at 55': AH HOME -0.5 on the remaining match (1-1) loses, OU 2.25 full match wins.
        external(c.in().provider(), "matches/results", Payloads.result(c.matchId(), "FINISHED", "{\"home\":2,\"away\":1}",
            null, "2026-11-09T20:00:00Z"));
    }

    @Test
    void latestPolicyCountsExactResendOnce() throws Exception {
        Case c = newCase();
        JsonNode first = post(c, c.send("e1-" + c.matchId()));
        JsonNode second = post(c, c.send("e2-" + c.matchId())); // same predictedAt: the tie-break counts the later insert
        finish(c);
        String q = "?providerId=" + providerId(c.in());

        JsonNode perf = adminGet("/api/v1/reports/model-performance" + q);
        assertThat(perf).hasSize(1);
        assertThat(perf.get(0).get("predictions").asInt()).isEqualTo(1);
        assertThat(perf.get(0).get("picks").asInt()).isEqualTo(2);
        assertThat(perf.get(0).get("wins").asInt()).isEqualTo(1);
        assertThat(perf.get(0).get("notCountedPredictions").asInt()).isEqualTo(1);

        JsonNode totals = adminGet("/api/v1/dashboard" + q).get("totals");
        assertThat(totals.get("totalPredictions").asInt()).isEqualTo(1);
        assertThat(totals.get("picks").asInt()).isEqualTo(2);
        assertThat(totals.get("notCountedPredictions").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/reports/market-performance" + q).findValues("picks").stream().mapToInt(JsonNode::asInt).sum())
            .isEqualTo(2);
        assertThat(adminGet("/api/v1/reports/monte-carlo" + q).get("summary").get("simulatedPredictions").asInt()).isEqualTo(1);

        UUID modelId = db.queryForObject("SELECT ai_model_id FROM predictions WHERE id = ?", UUID.class,
            UUID.fromString(first.get("predictionId").asText()));
        JsonNode model = adminGet("/api/v1/models/" + modelId);
        assertThat(model.get("totalPredictions").asInt()).isEqualTo(1);
        assertThat(model.get("wins").asInt()).isEqualTo(1);

        JsonNode matchModels = adminGet("/api/v1/matches/" + first.get("matchId").asText()).get("models");
        assertThat(matchModels.get(0).get("predictions").asInt()).isEqualTo(2); // the list view: every row
        assertThat(matchModels.get(0).get("wins").asInt()).isEqualTo(1);        // the aggregate: counted once

        // Lists show both rows and mark the superseded one.
        JsonNode list = adminGet("/api/v1/predictions" + q + "&sort=predictedAt,desc");
        assertThat(list.get("meta").get("totalElements").asInt()).isEqualTo(2);
        for (JsonNode row : list.get("data")) {
            assertThat(row.get("counted").asBoolean()).isEqualTo(row.get("id").asText().equals(second.get("predictionId").asText()));
        }
        assertThat(adminGet("/api/v1/reports/prediction-history" + q).get("meta").get("totalElements").asInt()).isEqualTo(4);

        JsonNode older = adminGet("/api/v1/predictions/" + first.get("predictionId").asText());
        assertThat(older.get("counted").asBoolean()).isFalse();
        assertThat(older.get("similar")).hasSize(1);
        assertThat(older.get("similar").get(0).get("predictionId").asText()).isEqualTo(second.get("predictionId").asText());
        assertThat(older.get("similar").get(0).get("exact").asBoolean()).isTrue();
        assertThat(older.get("similar").get(0).get("counted").asBoolean()).isTrue();
        assertThat(adminGet("/api/v1/predictions/" + second.get("predictionId").asText()).get("counted").asBoolean()).isTrue();
    }

    @Test
    void allPolicyKeepsOldNumbers() throws Exception {
        Case c = newCase();
        post(c, c.send("e1-" + c.matchId()));
        post(c, c.send("e2-" + c.matchId()));
        finish(c);
        String q = "?countPolicy=all&providerId=" + providerId(c.in());
        JsonNode perf = adminGet("/api/v1/reports/model-performance" + q);
        assertThat(perf.get(0).get("predictions").asInt()).isEqualTo(2);
        assertThat(perf.get(0).get("wins").asInt()).isEqualTo(2);
        assertThat(perf.get(0).get("notCountedPredictions").asInt()).isZero();
        assertThat(adminGet("/api/v1/dashboard" + q).get("totals").get("totalPredictions").asInt()).isEqualTo(2);
    }

    @Test
    void liveSnapshotsAtDifferentMinutesBothCount() throws Exception {
        Case c = newCase();
        post(c, c.send("e1-" + c.matchId()));
        post(c, c.send("e2-" + c.matchId()).replace("\"matchMinute\": 55", "\"matchMinute\": 60"));
        JsonNode perf = adminGet("/api/v1/reports/model-performance?providerId=" + providerId(c.in()));
        assertThat(perf.get(0).get("predictions").asInt()).isEqualTo(2);
    }

    @Test
    void dateFilterDoesNotResurrectOlderDuplicate() throws Exception {
        Case c = newCase();
        String early = KICK_OFF.plusSeconds(55 * 60).toString();
        post(c, c.send("e1-" + c.matchId()));
        post(c, c.send("e2-" + c.matchId()).replace("\"predictedAt\": \"" + early, "\"predictedAt\": \""
            + KICK_OFF.plusSeconds(58 * 60)));
        // Only the older snapshot is inside the range, and the newer one outside it still supersedes it.
        String q = "?providerId=" + providerId(c.in()) + "&to=" + KICK_OFF.plusSeconds(56 * 60);
        assertThat(adminGet("/api/v1/dashboard" + q).get("totals").get("totalPredictions").asInt()).isZero();
        assertThat(adminGet("/api/v1/predictions" + q).get("meta").get("totalElements").asInt()).isEqualTo(1);
    }

    @Test
    void archivedMergedModelNeverSupersedes() throws Exception {
        Case c = newCase();
        JsonNode kept = post(c, c.send("e1-" + c.matchId()));
        String later = c.send("e2-" + c.matchId()).replace("\"name\": \"dup-model\"", "\"name\": \"dup-bad\"")
            .replace("\"predictedAt\": \"" + KICK_OFF.plusSeconds(55 * 60), "\"predictedAt\": \"" + KICK_OFF.plusSeconds(56 * 60));
        JsonNode bad = post(c, later);
        UUID target = db.queryForObject("SELECT ai_model_id FROM predictions WHERE id = ?", UUID.class,
            UUID.fromString(kept.get("predictionId").asText()));
        UUID child = db.queryForObject("SELECT ai_model_id FROM predictions WHERE id = ?", UUID.class,
            UUID.fromString(bad.get("predictionId").asText()));
        adminPost("/api/v1/models/" + child + "/merge", java.util.Map.of("targetModelId", target, "reason", "same model"));
        db.update("UPDATE ai_models SET archived_at = now() WHERE id = ?", child);
        // The archived child's later prediction is hidden, and it must not take the visible one down with it.
        JsonNode perf = adminGet("/api/v1/reports/model-performance?providerId=" + providerId(c.in()));
        assertThat(perf).hasSize(1);
        assertThat(perf.get(0).get("predictions").asInt()).isEqualTo(1);
    }

    @Test
    void invalidCountPolicyIs400() throws Exception {
        MvcResult res = mvc.perform(asAdmin(get("/api/v1/reports/model-performance?countPolicy=nope"))).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).get("code").asText()).isEqualTo("INVALID_COUNT_POLICY");
    }

    @Test
    void modelAndMatchStatsFollowCountPolicy() throws Exception {
        Case c = newCase();
        JsonNode first = post(c, c.send("e1-" + c.matchId()));
        post(c, c.send("e2-" + c.matchId()));
        finish(c);
        UUID modelId = db.queryForObject("SELECT ai_model_id FROM predictions WHERE id = ?", UUID.class,
            UUID.fromString(first.get("predictionId").asText()));
        String match = "/api/v1/matches/" + first.get("matchId").asText();

        JsonNode all = adminGet("/api/v1/models/" + modelId + "?countPolicy=all");
        assertThat(all.get("totalPredictions").asInt()).isEqualTo(2);
        assertThat(all.get("wins").asInt()).isEqualTo(2);
        assertThat(adminGet("/api/v1/models?countPolicy=all&providerId=" + providerId(c.in())).get(0).get("wins").asInt()).isEqualTo(2);
        assertThat(adminGet("/api/v1/models?providerId=" + providerId(c.in())).get(0).get("wins").asInt()).isEqualTo(1);
        assertThat(adminGet(match + "?countPolicy=all").get("models").get(0).get("wins").asInt()).isEqualTo(2);
        assertThat(adminGet(match + "?countPolicy=latest").get("models").get(0).get("wins").asInt()).isEqualTo(1);

        for (String url : new String[] {"/api/v1/models?countPolicy=nope", "/api/v1/models/" + modelId + "?countPolicy=nope",
            match + "?countPolicy=nope"}) {
            MvcResult res = mvc.perform(asAdmin(get(url))).andReturn();
            assertThat(res.getResponse().getStatus()).as(url).isEqualTo(400);
            assertThat(read(res).get("code").asText()).isEqualTo("INVALID_COUNT_POLICY");
        }
    }
}
