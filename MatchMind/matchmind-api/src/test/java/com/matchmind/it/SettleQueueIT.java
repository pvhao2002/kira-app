package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * The Google Sheet settlement loop: a trusted results key (scope RESULTS) lists every match that still has pending
 * picks, and posts the result of any of them by matchId, whichever provider sent the prediction.
 */
class SettleQueueIT extends IntegrationTestBase {

    private String feederKey(List<String> scopes) throws Exception {
        String code = "feed" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode p = adminPost("/api/v1/providers", Map.of("code", code, "name", "Sheet " + code));
        return adminPost("/api/v1/providers/" + p.get("id").asText() + "/keys", Map.of("label", "sheet", "scopes", scopes))
            .get("apiKey").asText();
    }

    private MvcResult unsettled(String key) throws Exception {
        return mvc.perform(get("/api/v1/external/matches/unsettled").header("X-Api-Key", key)).andReturn();
    }

    private JsonNode row(JsonNode list, String matchId) {
        for (JsonNode r : list) if (r.get("matchId").asText().equals(matchId)) return r;
        return null;
    }

    @Test
    void aResultsKeyListsPendingMatchesOfEveryProviderAndSettlesThemByMatchId() throws Exception {
        Integration agent = newIntegration("gpt-q");
        String ext = "q-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode pred = read(external(agent.provider(), "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), ext, agent.modelName())));
        String matchId = pred.get("matchId").asText();
        String key = feederKey(List.of("RESULTS"));

        MvcResult res = unsettled(key);
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        JsonNode r = row(read(res), matchId);
        assertThat(r).isNotNull();
        assertThat(r.get("provider").asText()).isEqualTo(agent.provider());
        assertThat(r.get("homeTeam").asText()).isEqualTo("Arsenal");
        assertThat(r.get("awayTeam").asText()).startsWith("Chelsea");
        assertThat(r.get("startTime").asText()).isEqualTo("2026-11-10T19:45:00Z");
        assertThat(r.get("pendingPicks").asInt()).isEqualTo(pred.get("picks").size());

        MvcResult posted = externalWith(Map.of("X-Api-Key", key), "matches/results",
            "{\"matchId\": \"" + matchId + "\", \"status\": \"FINISHED\", \"finalScore\": {\"home\": 2, \"away\": 1},"
                + " \"resultAt\": \"2026-11-10T21:40:00Z\"}");
        assertThat(posted.getResponse().getStatus()).as(posted.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(read(posted).get("settlement").get("pending").asInt()).isZero();
        assertThat(row(read(unsettled(key)), matchId)).isNull();
    }

    @Test
    void onlyAPerProviderResultsKeyMayListTheQueue() throws Exception {
        assertThat(unsettled(feederKey(List.of("PREDICTIONS", "SETTLE_REQUEST"))).getResponse().getStatus()).isEqualTo(403);
        // The legacy shared key is not a trusted source: it never sees other providers' matches.
        assertThat(mvc.perform(get("/api/v1/external/matches/unsettled").header("X-Api-Key", EXTERNAL_KEY)
            .header("X-Provider", "legacy-q")).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(unsettled("mmk_nope_nope").getResponse().getStatus()).isEqualTo(401);
    }
}
