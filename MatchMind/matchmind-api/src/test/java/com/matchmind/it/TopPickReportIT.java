package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class TopPickReportIT extends IntegrationTestBase {

    @Test
    void topPickCountsOnlyTheLowestRankedPick() throws Exception {
        Integration in = newIntegration("top-pick");
        String matchId = "tp-" + UUID.randomUUID().toString().substring(0, 8);
        // Two picks: rank 1 AH, rank 2 OU. Settle, then force rank 1 WIN and rank 2 LOSS.
        JsonNode res = read(external(in.provider(), "predictions", Payloads.livePrediction("e-" + matchId, matchId, in.modelName())));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        for (JsonNode pick : res.get("picks")) {
            adminPost("/api/v1/settlements/picks/" + pick.get("pickId").asText() + "/override",
                Map.of("result", pick.get("rank").asInt() == 1 ? "WIN" : "LOSS", "reason", "top pick test"));
        }
        String q = "?providerId=" + providerId(in);

        JsonNode top = adminGet("/api/v1/reports/top-pick" + q);
        JsonNode total = top.get("total");
        assertThat(total.get("picks").asInt()).isEqualTo(1);
        assertThat(total.get("wins").asInt()).isEqualTo(1);
        assertThat(total.get("losses").asInt()).isZero();
        assertThat(total.get("winRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(total.get("units").decimalValue()).isEqualByComparingTo("0.95"); // AH HOME at 1.95
        assertThat(total.get("roi").decimalValue()).isEqualByComparingTo("0.95");
        assertThat(top.get("rows")).hasSize(1);
        assertThat(top.get("rows").get(0).get("key").asText()).isEqualTo(in.modelName() + " 1.0");
        assertThat(top.get("rows").get(0).get("picks").asInt()).isEqualTo(1);

        // Every pick still counts in the breakdown.
        JsonNode breakdown = adminGet("/api/v1/reports/breakdown" + q + "&by=model");
        assertThat(breakdown.get(0).get("picks").asInt()).isEqualTo(2);
        assertThat(breakdown.get(0).get("wins").asInt()).isEqualTo(1);
        assertThat(breakdown.get(0).get("losses").asInt()).isEqualTo(1);

        JsonNode byMarket = adminGet("/api/v1/reports/top-pick" + q + "&by=market").get("rows");
        assertThat(byMarket).hasSize(1);
        assertThat(byMarket.get(0).get("key").asText()).isEqualTo("AH");
        assertThat(byMarket.get(0).get("wins").asInt()).isEqualTo(1);

        for (String bad : new String[]{"stage", "nope"}) {
            MvcResult r = mvc.perform(asAdmin(get("/api/v1/reports/top-pick" + q + "&by=" + bad))).andReturn();
            assertThat(r.getResponse().getStatus()).isEqualTo(400);
            assertThat(r.getResponse().getContentAsString()).contains("INVALID_GROUP");
        }
    }
}
