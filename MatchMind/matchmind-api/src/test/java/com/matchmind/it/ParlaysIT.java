package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

class ParlaysIT extends IntegrationTestBase {
    private String pick(String matchId, String market) {
        return db.queryForObject("SELECT k.id::text FROM prediction_picks k JOIN predictions p ON p.id = k.prediction_id "
            + "JOIN matches m ON m.id = p.match_id WHERE m.external_match_id = ? AND k.market = ?", String.class, matchId, market);
    }

    private int create(String token, Object body) throws Exception {
        return mvc.perform(post("/api/v1/parlays").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn().getResponse().getStatus();
    }

    @Test
    void aParlayOfTwoMatchesSettlesFromItsLegsAndStaysWithItsOwner() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("parlay-model");
        String a = "pa-" + suffix, b = "pb-" + suffix;
        external(in.provider(), "predictions", Payloads.livePrediction("ea-" + suffix, a, in.modelName()));
        external(in.provider(), "predictions", Payloads.livePrediction("eb-" + suffix, b, in.modelName()));
        String overA = pick(a, "OU"), overB = pick(b, "OU"), ahA = pick(a, "AH");

        assertThat(create(adminToken, Map.of("pickIds", List.of(overA, ahA)))).isEqualTo(400);              // same match
        assertThat(create(adminToken, Map.of("pickIds", List.of(overA)))).isEqualTo(400);                   // one leg
        assertThat(create(adminToken, Map.of("pickIds", List.of(overA, UUID.randomUUID().toString())))).isEqualTo(404);
        assertThat(create(adminToken, Map.of("pickIds", List.of(overA, overB), "stake", 100))).isEqualTo(201);

        JsonNode parlay = adminGet("/api/v1/parlays").get("data").get(0);
        assertThat(parlay.get("legs")).hasSize(2);
        assertThat(parlay.get("totalOdds").decimalValue()).isEqualByComparingTo("3.4225");   // 1.85 x 1.85
        assertThat(parlay.get("result").asText()).isEqualTo("PENDING");

        // 2-1: both OVER 2.25 picks win.
        external(in.provider(), "matches/results", Payloads.result(a, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        assertThat(adminGet("/api/v1/parlays").get("data").get(0).get("result").asText()).isEqualTo("PENDING");
        external(in.provider(), "matches/results", Payloads.result(b, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        parlay = adminGet("/api/v1/parlays").get("data").get(0);
        assertThat(parlay.get("result").asText()).isEqualTo("WIN");
        assertThat(parlay.get("payout").decimalValue()).isEqualByComparingTo("342.25");
        assertThat(parlay.get("profit").decimalValue()).isEqualByComparingTo("242.25");

        // Another user sees none of it and cannot delete it.
        adminPost("/api/v1/users", Map.of("username", "parlay" + suffix, "password", "viewer-password-987", "role", "VIEWER"));
        String viewer = login("parlay" + suffix, "viewer-password-987");
        JsonNode theirs = read(mvc.perform(get("/api/v1/parlays").header("Authorization", "Bearer " + viewer)).andReturn());
        assertThat(theirs.get("meta").get("totalElements").asInt()).isZero();
        String id = parlay.get("id").asText();
        assertThat(mvc.perform(delete("/api/v1/parlays/" + id).header("Authorization", "Bearer " + viewer)).andReturn()
            .getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(asAdmin(delete("/api/v1/parlays/" + id))).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/parlays")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
