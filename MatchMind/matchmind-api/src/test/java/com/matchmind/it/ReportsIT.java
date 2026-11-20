package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

class ReportsIT extends IntegrationTestBase {

    @Test
    void reportsAggregateRealData() throws Exception {
        Integration a = newIntegration("model-a");
        String matchId = "rep-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode pa = read(external(a.provider(), "predictions", Payloads.livePrediction("ea-" + matchId, matchId, a.modelName())));
        // Second model of the same provider analyses the same match (created on its first call).
        read(external(a.provider(), "predictions", Payloads.livePrediction("eb-" + matchId, matchId, "model-b")));
        // Final 2-1 -> each model: AH LOSS, OU WIN.
        external(a.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));

        String q = "?providerId=" + providerId(a);
        JsonNode perf = adminGet("/api/v1/reports/model-performance" + q);
        assertThat(perf).hasSize(2);
        for (JsonNode row : perf) {
            assertThat(row.get("predictions").asInt()).isEqualTo(1);
            assertThat(row.get("wins").asInt()).isEqualTo(1);
            assertThat(row.get("losses").asInt()).isEqualTo(1);
            assertThat(row.get("winRate").decimalValue()).isEqualByComparingTo("0.5");
            assertThat(row.get("correctScoreHits").asInt()).isEqualTo(1); // predicted 2-1, actual 2-1
        }

        JsonNode markets = adminGet("/api/v1/reports/market-performance" + q);
        assertThat(markets).hasSize(5);
        JsonNode ah = find(markets, "market", "AH");
        assertThat(ah.get("losses").asInt()).isEqualTo(2);
        assertThat(find(markets, "market", "CORNER_OU").get("picks").asInt()).isZero();

        JsonNode history = adminGet("/api/v1/reports/prediction-history" + q + "&market=OU&size=10");
        assertThat(history.get("meta").get("totalElements").asInt()).isEqualTo(2);
        assertThat(history.get("data").get(0).get("result").asText()).isEqualTo("WIN");
        assertThat(history.get("data").get(0).get("price").decimalValue()).isEqualByComparingTo("1.85");

        JsonNode comparison = adminGet("/api/v1/reports/model-comparison" + q);
        assertThat(comparison.get("data")).hasSize(1);
        assertThat(comparison.get("data").get(0).get("models")).hasSize(2);

        JsonNode mc = adminGet("/api/v1/reports/monte-carlo" + q);
        assertThat(mc.get("summary").get("simulatedPredictions").asInt()).isEqualTo(2);
        // Expected 1.2 remaining goals vs 2 actually scored after 1-0.
        assertThat(mc.get("summary").get("avgActualRemainingGoals").decimalValue()).isEqualByComparingTo("2");

        JsonNode dashboard = adminGet("/api/v1/dashboard" + q);
        assertThat(dashboard.get("totals").get("totalPredictions").asInt()).isEqualTo(2);
        assertThat(dashboard.get("totals").get("wins").asInt()).isEqualTo(2);
        assertThat(dashboard.get("totals").get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(dashboard.get("winRateOverTime")).isNotEmpty();

        JsonNode detail = adminGet("/api/v1/predictions/" + pa.get("predictionId").asText());
        assertThat(detail.get("odds")).hasSize(3);
        assertThat(detail.get("simulation").get("simulationCount").asInt()).isEqualTo(1000);
        assertThat(detail.get("picks").get(0).get("settlementStatus").asText()).isEqualTo("LOSS");
        assertThat(detail.get("payload").get("eventId").asText()).isEqualTo("ea-" + matchId);

        JsonNode matchDetail = adminGet("/api/v1/matches/" + pa.get("matchId").asText());
        assertThat(matchDetail.get("models")).hasSize(2);
        assertThat(matchDetail.get("resultHistory")).hasSize(1);

        MvcResult csv = mvc.perform(asAdmin(get("/api/v1/reports/prediction-history/export" + q + "&format=csv"))).andReturn();
        assertThat(csv.getResponse().getContentAsString()).contains("predictedAt").contains("Premier League");
        MvcResult xlsx = mvc.perform(asAdmin(get("/api/v1/reports/prediction-history/export" + q + "&format=xlsx"))).andReturn();
        byte[] bytes = xlsx.getResponse().getContentAsByteArray();
        assertThat(bytes[0]).isEqualTo((byte) 'P'); // zip signature
        assertThat(bytes[1]).isEqualTo((byte) 'K');

        assertThat(mvc.perform(asAdmin(get("/api/v1/reports/model-performance?market=NOPE"))).andReturn().getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void defaultPromptsExistAndEditsAreVersioned() throws Exception {
        JsonNode prompts = adminGet("/api/v1/prompts");
        assertThat(prompts.findValuesAsText("templateType")).contains("AI_PREDICTION", "AI_SETTLEMENT");
        JsonNode prediction = find(prompts, "templateType", "AI_PREDICTION");
        assertThat(prediction.get("content").asText()).contains("1000").contains("REMAINING_MATCH");
        String id = prediction.get("id").asText();
        int version = prediction.get("version").asInt();

        String body = "{\"content\":\"line 1\\nline 2\",\"description\":\"d\",\"active\":true,\"expectedVersion\":" + version + "}";
        MvcResult saved = mvc.perform(asAdmin(put("/api/v1/prompts/" + id)).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
        assertThat(saved.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(saved).get("content").asText()).isEqualTo("line 1\nline 2");
        assertThat(read(saved).get("version").asInt()).isEqualTo(version + 1);

        // Saving on top of a stale version is rejected instead of silently overwriting.
        MvcResult stale = mvc.perform(asAdmin(put("/api/v1/prompts/" + id)).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("line 2", "line 3"))).andReturn();
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
    }

    private static JsonNode find(JsonNode array, String field, String value) {
        for (JsonNode n : array) if (value.equals(n.get(field).asText())) return n;
        throw new AssertionError(field + "=" + value + " not found");
    }
}
