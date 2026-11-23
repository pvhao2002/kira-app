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
        assertThat(prompts.findValuesAsText("templateType")).contains("AI_PREDICTION", "AI_SHEET_SETTLEMENT").doesNotContain("AI_SETTLEMENT");
        JsonNode prediction = find(prompts, "templateType", "AI_PREDICTION");
        assertThat(prediction.get("content").asText()).contains("1000").contains("REMAINING_MATCH");
        String id = prediction.get("id").asText();
        int version = prediction.get("version").asInt();

        try {
            String body = "{\"content\":\"line 1\\nline 2\",\"description\":\"d\",\"active\":true,\"expectedVersion\":" + version + "}";
            MvcResult saved = mvc.perform(asAdmin(put("/api/v1/prompts/" + id)).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
            assertThat(saved.getResponse().getStatus()).isEqualTo(200);
            assertThat(read(saved).get("content").asText()).isEqualTo("line 1\nline 2");
            assertThat(read(saved).get("version").asInt()).isEqualTo(version + 1);

            // Saving on top of a stale version is rejected instead of silently overwriting.
            MvcResult stale = mvc.perform(asAdmin(put("/api/v1/prompts/" + id)).contentType(MediaType.APPLICATION_JSON)
                .content(body.replace("line 2", "line 3"))).andReturn();
            assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        } finally {
            // The database is shared by every IT class: put the seeded prompt back, or the prompt ITs that run after
            // this one read "line 1\nline 2" (the class order differs between machines). History is append-only, so the
            // original text comes back as a new version, as a restore does.
            db.update("UPDATE prompt_templates t SET content = v.content, description = v.description, active = v.active, "
                + "version = t.version + 1, updated_by = v.updated_by FROM prompt_template_versions v "
                + "WHERE t.id = ?::uuid AND v.template_id = t.id AND v.version = ?", id, version);
        }
    }

    private static JsonNode find(JsonNode array, String field, String value) {
        for (JsonNode n : array) if (value.equals(n.get(field).asText())) return n;
        throw new AssertionError(field + "=" + value + " not found");
    }

    @Test
    void modelComparisonComparesModelsOfDifferentProvidersOnOneFixture() throws Exception {
        String t = UUID.randomUUID().toString().substring(0, 8);
        java.time.Instant kickOff = java.time.Instant.parse("2026-11-09T18:00:00Z");
        for (String p : new String[]{"ra" + t, "rb" + t}) {
            external(p, "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(), "rc-" + UUID.randomUUID(),
                "model-" + p, "Pumas " + t, "Jaguars " + t, "League", kickOff));
        }
        JsonNode cmp = adminGet("/api/v1/reports/model-comparison?minModels=2&search=" + t);
        assertThat(cmp.get("data")).hasSize(1);
        JsonNode row = cmp.get("data").get(0);
        assertThat(row.get("fixtureId").asText()).isNotBlank();
        assertThat(row.get("resultMismatch").asBoolean()).isFalse();
        assertThat(row.get("models")).hasSize(2);
        assertThat(row.get("models").get(0).get("providerName").asText()).isNotBlank();
        assertThat(row.get("models").get(0).get("matchId").asText()).isNotEqualTo(row.get("models").get(1).get("matchId").asText());
    }

    // ---------------------------------------------------------------- UX-018 ROI / units / calibration

    /**
     * One PRE_MATCH prediction per price, each on its own match (so the latest-counts policy keeps all of them) with a
     * single OU 2.5 OVER pick, settled 2-1 and then overridden to the given result. Filter on the returned provider.
     */
    private Integration seedPicks(String[] prices, String[] probabilities, String[] results) throws Exception {
        Integration in = newIntegration("roi-model");
        for (int i = 0; i < prices.length; i++) {
            String matchId = "roi-" + UUID.randomUUID().toString().substring(0, 8);
            String body = """
                {"eventId": "e-%1$s", "model": {"name": "%2$s", "version": "1.0"},
                 "match": {"externalMatchId": "%1$s", "league": "ROI League", "homeTeam": "Home %1$s", "awayTeam": "Away %1$s",
                           "startTime": "2026-11-11T20:00:00Z"},
                 "predictionType": "PRE_MATCH", "predictedAt": "2026-11-11T18:00:00Z",
                 "odds": [{"ref": "ou", "market": "OU", "stage": "PRE_MATCH", "line": 2.5, "overOdds": %3$s, "underOdds": 1.90}],
                 "picks": [{"oddsRef": "ou", "market": "OU", "pick": "OVER", "probability": %4$s, "rank": 1}],
                 "correctScore": {"home": 2, "away": 1, "probability": 0.1}}
                """.formatted(matchId, in.modelName(), prices[i], probabilities[i]);
            MvcResult res = external(in.provider(), "predictions", body);
            assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isLessThan(300);
            String pickId = read(res).get("picks").get(0).get("pickId").asText();
            external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-11T21:55:00Z"));
            adminPost("/api/v1/settlements/picks/" + pickId + "/override", Map.of("result", results[i], "reason", "roi test"));
        }
        return in;
    }

    private static final String[] SIX_PRICES = {"1.90", "2.10", "1.80", "1.95", "2.00", "1.85"};
    private static final String[] SIX_PROBABILITIES = {"0.55", "0.52", "0.61", "0.48", "0.50", "0.53"};
    private static final String[] SIX_RESULTS = {"WIN", "HALF_WIN", "LOSS", "HALF_LOSS", "PUSH", "VOID"};

    @Test
    void roiAndUnitsFollowFixedStake() throws Exception {
        // WIN 1.90 -> +0.90, HALF_WIN 2.10 -> +0.55, LOSS -> -1, HALF_LOSS -> -0.5, PUSH -> 0, VOID excluded: -0.050 / 5.
        Integration in = seedPicks(SIX_PRICES, SIX_PROBABILITIES, SIX_RESULTS);
        String q = "?providerId=" + providerId(in);

        JsonNode row = adminGet("/api/v1/reports/model-performance" + q).get(0);
        assertThat(row.get("units").decimalValue()).isEqualByComparingTo("-0.050");
        assertThat(row.get("staked").asInt()).isEqualTo(5);
        assertThat(row.get("roi").decimalValue()).isEqualByComparingTo("-0.0100");
        assertThat(row.get("winRate").decimalValue()).isEqualByComparingTo("0.5");

        JsonNode model = adminGet("/api/v1/models/" + row.get("modelId").asText());
        assertThat(model.get("units").decimalValue()).isEqualByComparingTo("-0.050");
        assertThat(model.get("staked").asInt()).isEqualTo(5);
        assertThat(model.get("roi").decimalValue()).isEqualByComparingTo("-0.0100");

        JsonNode dashboard = adminGet("/api/v1/dashboard" + q);
        JsonNode totals = dashboard.get("totals");
        assertThat(totals.get("units").decimalValue()).isEqualByComparingTo("-0.050");
        assertThat(totals.get("staked").asInt()).isEqualTo(5);
        assertThat(totals.get("roi").decimalValue()).isEqualByComparingTo("-0.0100");
        assertThat(dashboard.get("winRateOverTime").get(0).get("units").decimalValue()).isEqualByComparingTo("-0.050");

        JsonNode markets = adminGet("/api/v1/reports/market-performance" + q);
        assertThat(find(markets, "market", "OU").get("roi").decimalValue()).isEqualByComparingTo("-0.0100");
        JsonNode ah = find(markets, "market", "AH");
        assertThat(ah.get("units").isNull()).isTrue();
        assertThat(ah.get("staked").asInt()).isZero();
        assertThat(ah.get("roi").isNull()).isTrue();
        assertThat(adminGet("/api/v1/reports/breakdown" + q + "&by=market").get(0).get("units").decimalValue())
            .isEqualByComparingTo("-0.050");

        JsonNode history = adminGet("/api/v1/reports/prediction-history" + q + "&sort=price,asc&size=10").get("data");
        assertThat(history.get(0).get("units").decimalValue()).isEqualByComparingTo("-1"); // 1.80 LOSS
        assertThat(history.get(1).get("units").isNull()).isTrue(); // 1.85 VOID
        assertThat(history.get(5).get("units").decimalValue()).isEqualByComparingTo("0.550"); // 2.10 HALF_WIN
    }

    @Test
    void pendingOnlyModelHasNullUnitsAndRoi() throws Exception {
        Integration in = newIntegration("pending-model");
        String matchId = "pend-" + UUID.randomUUID().toString().substring(0, 8);
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + matchId, matchId, in.modelName()));
        JsonNode row = adminGet("/api/v1/reports/model-performance?providerId=" + providerId(in)).get(0);
        assertThat(row.get("units").isNull()).isTrue();
        assertThat(row.get("staked").asInt()).isZero();
        assertThat(row.get("roi").isNull()).isTrue();
        JsonNode model = adminGet("/api/v1/models/" + row.get("modelId").asText());
        assertThat(model.get("units").isNull()).isTrue();
        assertThat(model.get("roi").isNull()).isTrue();
    }

    @Test
    void minimumPriceWinIsExact() throws Exception {
        Integration in = seedPicks(new String[]{"1.01"}, new String[]{"0.9"}, new String[]{"WIN"});
        // Raw JSON: exact NUMERIC text, no float artefact such as 0.0099999.
        String body = mvc.perform(asAdmin(get("/api/v1/reports/model-performance?providerId=" + providerId(in))))
            .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("\"units\":0.010,").contains("\"roi\":0.0100");
    }

    @Test
    void calibrationAlwaysReturnsTenBins() throws Exception {
        Integration in = newIntegration("calib-empty");
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(), "c-" + UUID.randomUUID(), in.modelName()));
        JsonNode cal = adminGet("/api/v1/reports/calibration?providerId=" + providerId(in));
        assertThat(cal.get("bins")).hasSize(10);
        assertThat(cal.get("evaluated").asInt()).isZero();
        assertThat(cal.get("excluded").asInt()).isZero();
        JsonNode first = cal.get("bins").get(0);
        assertThat(first.get("bin").asInt()).isEqualTo(1);
        assertThat(first.get("from").decimalValue()).isEqualByComparingTo("0");
        assertThat(first.get("to").decimalValue()).isEqualByComparingTo("0.1");
        assertThat(first.get("picks").asInt()).isZero();
        assertThat(first.get("hitRate").isNull()).isTrue();
        assertThat(first.get("avgProbability").isNull()).isTrue();
        assertThat(cal.get("bins").get(9).get("to").decimalValue()).isEqualByComparingTo("1");
    }

    @Test
    void probabilityOneLandsInBinTen() throws Exception {
        Integration in = seedPicks(new String[]{"1.50", "1.60"}, new String[]{"1", "0"}, new String[]{"WIN", "LOSS"});
        JsonNode bins = adminGet("/api/v1/reports/calibration?providerId=" + providerId(in)).get("bins");
        assertThat(bins).hasSize(10);
        assertThat(bins.get(9).get("picks").asInt()).isEqualTo(1);
        assertThat(bins.get(9).get("hitRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(bins.get(9).get("avgProbability").decimalValue()).isEqualByComparingTo("1");
        assertThat(bins.get(0).get("picks").asInt()).isEqualTo(1);
        assertThat(bins.get(0).get("hitRate").decimalValue()).isEqualByComparingTo("0");
    }

    @Test
    void halfResultsAreExcludedAndCounted() throws Exception {
        Integration in = seedPicks(SIX_PRICES, SIX_PROBABILITIES, SIX_RESULTS);
        String q = "?providerId=" + providerId(in);
        JsonNode cal = adminGet("/api/v1/reports/calibration" + q);
        assertThat(cal.get("evaluated").asInt()).isEqualTo(2);
        assertThat(cal.get("excluded").asInt()).isEqualTo(4);
        JsonNode bins = cal.get("bins");
        assertThat(bins.get(5).get("picks").asInt()).isEqualTo(1); // 0.55 WIN
        assertThat(bins.get(5).get("hitRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(bins.get(6).get("picks").asInt()).isEqualTo(1); // 0.61 LOSS
        assertThat(bins.get(6).get("hitRate").decimalValue()).isEqualByComparingTo("0");
        assertThat(bins.get(6).get("avgProbability").decimalValue()).isEqualByComparingTo("0.61");
        // Filters narrow calibration exactly as they narrow the win rate.
        JsonNode ah = adminGet("/api/v1/reports/calibration" + q + "&market=AH");
        assertThat(ah.get("evaluated").asInt()).isZero();
        assertThat(ah.get("excluded").asInt()).isZero();
    }

    // ---------------------------------------------------------------- PRE_MATCH vs LIVE comparison

    @Test
    void typeComparisonPutsBothTypesInOneRowAndIgnoresTypeFilter() throws Exception {
        Integration in = newIntegration("tc-model");
        String pre = "tcp-" + UUID.randomUUID().toString().substring(0, 8), live = "tcl-" + UUID.randomUUID().toString().substring(0, 8);
        external(in.provider(), "predictions", Payloads.preMatchWithCorners("e-" + pre, pre, in.modelName(), "HOME"));
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + live, live, in.modelName()));

        JsonNode rows = adminGet("/api/v1/reports/type-comparison?providerId=" + providerId(in) + "&type=LIVE&by=model");
        assertThat(rows).hasSize(1);
        JsonNode row = rows.get(0);
        assertThat(row.get("key").asText()).isEqualTo(in.modelName() + " 1.0");
        assertThat(row.get("preMatch").get("picks").asInt()).isPositive();
        assertThat(row.get("live").get("picks").asInt()).isPositive();
    }

    @Test
    void typeComparisonMissingSideIsNullAndDeltasNull() throws Exception {
        Integration in = newIntegration("tc-live-only");
        String live = "tcl-" + UUID.randomUUID().toString().substring(0, 8);
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + live, live, in.modelName()));

        JsonNode row = adminGet("/api/v1/reports/type-comparison?providerId=" + providerId(in)).get(0);
        assertThat(row.get("preMatch").isNull()).isTrue();
        assertThat(row.get("winRateDelta").isNull()).isTrue();
        assertThat(row.get("roiDelta").isNull()).isTrue();
        assertThat(row.get("live").get("winRate").isNull()).isTrue(); // all pending
    }

    @Test
    void typeComparisonDeltaIsLiveMinusPreMatch() throws Exception {
        Integration in = newIntegration("tc-delta");
        String pre = "tcp-" + UUID.randomUUID().toString().substring(0, 8), live = "tcl-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode preRes = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners("e-" + pre, pre, in.modelName(), "HOME")));
        JsonNode liveRes = read(external(in.provider(), "predictions", Payloads.livePrediction("e-" + live, live, in.modelName())));
        external(in.provider(), "matches/results", Payloads.result(pre, "FINISHED", "{\"home\":2,\"away\":1}", "{\"home\":5,\"away\":4}", "2026-11-11T22:00:00Z"));
        external(in.provider(), "matches/results", Payloads.result(live, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        for (JsonNode pick : preRes.get("picks")) override(pick, "LOSS");
        for (JsonNode pick : liveRes.get("picks")) override(pick, "WIN");

        JsonNode row = adminGet("/api/v1/reports/type-comparison?providerId=" + providerId(in)).get(0);
        JsonNode p = row.get("preMatch"), l = row.get("live");
        assertThat(p.get("winRate").decimalValue()).isEqualByComparingTo("0");
        assertThat(l.get("winRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(row.get("winRateDelta").decimalValue())
            .isEqualByComparingTo(l.get("winRate").decimalValue().subtract(p.get("winRate").decimalValue()));
        assertThat(row.get("roiDelta").decimalValue())
            .isEqualByComparingTo(l.get("roi").decimalValue().subtract(p.get("roi").decimalValue()));
    }

    private void override(JsonNode pick, String result) throws Exception {
        adminPost("/api/v1/settlements/picks/" + pick.get("pickId").asText() + "/override", Map.of("result", result, "reason", "tc test"));
    }

    @Test
    void typeComparisonRejectsUnknownGroup() throws Exception {
        MvcResult res = mvc.perform(asAdmin(get("/api/v1/reports/type-comparison?by=type"))).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(res.getResponse().getContentAsString()).contains("INVALID_GROUP");
    }
}
