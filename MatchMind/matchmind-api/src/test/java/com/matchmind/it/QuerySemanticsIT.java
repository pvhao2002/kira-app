package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Read-side filter semantics: accent-insensitive search, normalised league, date ranges, overdue, result scope. */
class QuerySemanticsIT extends IntegrationTestBase {

    /** MockMvc encodes the URL template itself, so values go in raw. */
    private static String enc(String s) {
        return s;
    }

    /** One LIVE prediction (top pick AH, second pick OU) for an accented match; returns the provider id. */
    private UUID seedAccentedMatch(String suffix, String league) throws Exception {
        Integration in = newIntegration("acc-model");
        String body = Payloads.livePrediction("evt-" + suffix, "acc-" + suffix, in.modelName())
            .replace("Premier League", league)
            .replace("Arsenal", "Atlético Madrid")
            .replace("Chelsea", "Bayern München"); // stored decomposed (NFD)
        assertThat(external(in.provider(), "predictions", body).getResponse().getStatus()).isEqualTo(201);
        return providerId(in);
    }

    @Test
    void searchIgnoresAccentsCaseAndUnicodeForm() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID provider = seedAccentedMatch(suffix, "Liga Ñandú " + suffix);
        for (String q : new String[]{"atletico", "ATLÉTICO", "munchen", "MÜNCHEN", "nandu"}) {
            JsonNode matches = adminGet("/api/v1/matches?providerId=" + provider + "&search=" + enc(q));
            assertThat(matches.get("meta").get("totalElements").asInt()).as("matches search=" + q).isEqualTo(1);
            JsonNode predictions = adminGet("/api/v1/predictions?providerId=" + provider + "&search=" + enc(q));
            assertThat(predictions.get("meta").get("totalElements").asInt()).as("predictions search=" + q).isEqualTo(1);
        }
        assertThat(adminGet("/api/v1/matches?providerId=" + provider + "&search=madridx").get("meta").get("totalElements").asInt()).isZero();
    }

    @Test
    void apiLogSearchIgnoresAccentsAndCase() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("log-model");
        // The audit keeps the eventId as sent even when the body is rejected.
        external(in.provider(), "predictions", Payloads.livePrediction("Ñandú-" + suffix, "log-" + suffix, in.modelName()));
        for (String q : new String[]{"nandu-" + suffix, "ÑANDÚ-" + suffix, "Ñandú-" + suffix}) {
            assertThat(adminGet("/api/v1/api-logs?search=" + enc(q))
                .get("meta").get("totalElements").asInt()).as("api-logs search=" + q).isEqualTo(1);
        }
    }

    @Test
    void leagueFilterIsTrimmedCaseAndAccentInsensitive() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID provider = seedAccentedMatch(suffix, "Liga Ñandú " + suffix);
        for (String league : new String[]{"Liga Ñandú " + suffix, "  liga ñandú " + suffix + " ", "LIGA NANDU " + suffix}) {
            assertThat(adminGet("/api/v1/matches?providerId=" + provider + "&league=" + enc(league))
                .get("meta").get("totalElements").asInt()).as("matches league=" + league).isEqualTo(1);
            assertThat(adminGet("/api/v1/predictions?providerId=" + provider + "&league=" + enc(league))
                .get("meta").get("totalElements").asInt()).as("predictions league=" + league).isEqualTo(1);
            assertThat(adminGet("/api/v1/dashboard?providerId=" + provider + "&league=" + enc(league))
                .get("totals").get("totalPredictions").asInt()).as("dashboard league=" + league).isEqualTo(1);
        }
        // Still an exact (normalised) match, not a prefix: "Liga" alone is a different league.
        assertThat(adminGet("/api/v1/matches?providerId=" + provider + "&league=Liga").get("meta").get("totalElements").asInt()).isZero();
    }

    @Test
    void reversedDateRangeIsAFieldErrorOnEveryEndpoint() throws Exception {
        String range = "from=2026-12-31T00:00:00Z&to=2026-12-01T00:00:00Z";
        for (String path : new String[]{"/api/v1/matches", "/api/v1/predictions", "/api/v1/dashboard",
            "/api/v1/reports/model-performance", "/api/v1/reports/prediction-history", "/api/v1/reports/monte-carlo"}) {
            MvcResult res = mvc.perform(asAdmin(get(path + "?" + range))).andReturn();
            assertThat(res.getResponse().getStatus()).as(path).isEqualTo(400);
            JsonNode err = read(res);
            assertThat(err.get("code").asText()).as(path).isEqualTo("INVALID_DATE_RANGE");
            assertThat(err.get("fieldErrors").has("from")).as(path).isTrue();
        }
        // One-sided ranges are open-ended.
        assertThat(mvc.perform(asAdmin(get("/api/v1/matches?from=2026-12-01T00:00:00Z"))).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(asAdmin(get("/api/v1/predictions?to=2026-12-01T00:00:00Z"))).andReturn().getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void overdueMatchesAreFlaggedFilteredAndCounted() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("od-model");
        String stuck = "od-stuck-" + suffix, upcoming = "od-next-" + suffix;
        assertThat(external(in.provider(), "predictions", Payloads.livePrediction("e1-" + suffix, stuck, in.modelName()))
            .getResponse().getStatus()).isEqualTo(201);
        assertThat(external(in.provider(), "predictions", Payloads.livePrediction("e2-" + suffix, upcoming, in.modelName()))
            .getResponse().getStatus()).isEqualTo(201);
        db.update("UPDATE matches SET start_time = now() - interval '5 hours', status = 'LIVE' WHERE external_match_id = ?", stuck);
        db.update("UPDATE matches SET start_time = now() + interval '1 day', status = 'SCHEDULED' WHERE external_match_id = ?", upcoming);
        UUID provider = providerId(in);

        JsonNode all = adminGet("/api/v1/matches?providerId=" + provider + "&sort=startTime,asc");
        assertThat(all.get("meta").get("totalElements").asInt()).isEqualTo(2);
        assertThat(all.get("data").get(0).get("overdue").asBoolean()).isTrue();
        assertThat(all.get("data").get(1).get("overdue").asBoolean()).isFalse();

        JsonNode overdue = adminGet("/api/v1/matches?providerId=" + provider + "&overdue=true");
        assertThat(overdue.get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(overdue.get("data").get(0).get("externalMatchId").asText()).isEqualTo(stuck);

        JsonNode dashboard = adminGet("/api/v1/dashboard?providerId=" + provider);
        assertThat(dashboard.get("totals").get("overdueMatches").asInt()).isEqualTo(1);
    }

    @Test
    void predictionsFilterByKickOffTimeNotPredictionTime() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("ko-model");
        // Kick-off 2026-11-10T19:45Z; the prediction itself is received now.
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + suffix, "ko-" + suffix, in.modelName()));
        String q = "/api/v1/predictions?providerId=" + providerId(in);

        assertThat(adminGet(q + "&kickoffFrom=2026-11-10T19:00:00Z&kickoffTo=2026-11-10T20:00:00Z")
            .get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(adminGet(q + "&kickoffFrom=2026-11-10T19:46:00Z").get("meta").get("totalElements").asInt()).isZero();
        assertThat(adminGet(q + "&kickoffTo=2026-11-10T19:45:00Z").get("meta").get("totalElements").asInt()).isZero();
        MvcResult reversed = mvc.perform(asAdmin(get(q + "&kickoffFrom=2026-11-11T00:00:00Z&kickoffTo=2026-11-10T00:00:00Z"))).andReturn();
        assertThat(reversed.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(reversed).get("code").asText()).isEqualTo("INVALID_DATE_RANGE");
    }

    @Test
    void liveFirstPutsMatchesBeingPlayedOnTopThenFollowsTheSort() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("lf-model");
        external(in.provider(), "predictions", Payloads.livePrediction("e1-" + suffix, "lf1-" + suffix, in.modelName()));
        external(in.provider(), "predictions", Payloads.livePrediction("e2-" + suffix, "lf2-" + suffix, in.modelName()));
        db.update("UPDATE matches SET status = 'SCHEDULED' WHERE external_match_id = ?", "lf1-" + suffix);
        db.update("UPDATE matches SET status = 'LIVE' WHERE external_match_id = ?", "lf2-" + suffix);
        String q = "/api/v1/predictions?providerId=" + providerId(in) + "&sort=startTime,asc";

        assertThat(adminGet(q + "&liveFirst=true").get("data").get(0).get("matchStatus").asText()).isEqualTo("LIVE");
        assertThat(adminGet(q.replace("asc", "desc") + "&liveFirst=true").get("data").get(0).get("matchStatus").asText()).isEqualTo("LIVE");
    }

    @Test
    void predictionResultFilterCanMatchAnyPickAndRowsCarryPickCounts() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("rs-model");
        String matchId = "rs-" + suffix;
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + suffix, matchId, in.modelName()));
        // Final 2-1 -> top pick AH LOSS, second pick OU WIN.
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        String q = "/api/v1/predictions?providerId=" + providerId(in);

        assertThat(adminGet(q + "&result=WIN").get("meta").get("totalElements").asInt()).isZero();
        assertThat(adminGet(q + "&result=WIN&resultScope=TOP").get("meta").get("totalElements").asInt()).isZero();
        assertThat(adminGet(q + "&result=WIN&resultScope=ANY").get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(adminGet(q + "&result=WIN&resultScope=ANY&market=AH").get("meta").get("totalElements").asInt()).isZero();
        assertThat(adminGet(q + "&result=PENDING&resultScope=ANY").get("meta").get("totalElements").asInt()).isZero();
        assertThat(mvc.perform(asAdmin(get(q + "&resultScope=SOME"))).andReturn().getResponse().getStatus()).isEqualTo(400);

        JsonNode row = adminGet(q).get("data").get(0);
        assertThat(row.get("pickWins").asInt()).isEqualTo(1);
        assertThat(row.get("pickLosses").asInt()).isEqualTo(1);
        assertThat(row.get("pickHalfWins").asInt()).isZero();
        assertThat(row.get("pickHalfLosses").asInt()).isZero();
        assertThat(row.get("pickPushOrVoid").asInt()).isZero();
        assertThat(row.get("pickPending").asInt()).isZero();
    }

    @Test
    void reportsExposeExclusiveCountsPeriodAndComparisonCoverage() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Integration in = newIntegration("ex-a");
        String matchId = "ex-" + suffix;
        external(in.provider(), "predictions", Payloads.livePrediction("ea-" + suffix, matchId, "ex-a"));
        external(in.provider(), "predictions", Payloads.livePrediction("eb-" + suffix, matchId, "ex-b"));
        // Another game (other teams): same-provider rows of one game share a fixture and its result.
        external(in.provider(), "predictions", Payloads.livePrediction("ec-" + suffix, "ex-solo-" + suffix, "ex-a",
            "Everton", "Fulham", "Premier League", java.time.Instant.parse("2026-11-10T19:45:00Z")));
        external(in.provider(), "matches/results", Payloads.result(matchId, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        String q = "?providerId=" + providerId(in);

        for (JsonNode row : adminGet("/api/v1/reports/model-performance" + q)) assertExclusive(row);
        for (JsonNode row : adminGet("/api/v1/reports/market-performance" + q)) assertExclusive(row);
        JsonNode totals = adminGet("/api/v1/dashboard" + q + "&from=2026-11-01T00:00:00Z").get("totals");
        assertExclusive(totals);
        assertThat(totals.get("fullWins").asInt()).isEqualTo(2);
        assertThat(totals.get("fullLosses").asInt()).isEqualTo(2);

        JsonNode period = adminGet("/api/v1/dashboard" + q + "&from=2026-11-01T00:00:00Z").get("period");
        assertThat(period.get("from").asText()).isEqualTo("2026-11-01T00:00:00Z");
        assertThat(period.get("to").isNull()).isTrue();
        assertThat(period.get("basis").asText()).isEqualTo("predictedAt");
        assertThat(period.get("firstPredictedAt").asText()).isEqualTo("2026-11-10T20:40:00Z");
        assertThat(period.get("lastPredictedAt").asText()).isEqualTo("2026-11-10T20:40:00Z");

        JsonNode coverage = adminGet("/api/v1/reports/model-comparison/coverage" + q);
        assertThat(coverage).hasSize(2);
        assertThat(coverage.get(0).get("minModels").asInt()).isEqualTo(1);
        assertThat(coverage.get(0).get("matches").asInt()).isEqualTo(2);
        assertThat(coverage.get(1).get("minModels").asInt()).isEqualTo(2);
        assertThat(coverage.get(1).get("matches").asInt()).isEqualTo(1);

        JsonNode mc = adminGet("/api/v1/reports/monte-carlo" + q).get("summary");
        assertThat(mc.get("finishedPredictions").asInt()).isEqualTo(2);
        assertThat(mc.get("correctScoreHits").asInt()).isEqualTo(2);
    }

    private static void assertExclusive(JsonNode row) {
        long parts = row.get("fullWins").asLong() + row.get("halfWins").asLong() + row.get("fullLosses").asLong()
            + row.get("halfLosses").asLong() + row.get("pushOrVoid").asLong();
        assertThat(parts).as(row.toString()).isEqualTo(row.get("settled").asLong());
        assertThat(row.get("fullWins").asLong() + row.get("halfWins").asLong()).isEqualTo(row.get("wins").asLong());
        assertThat(row.get("fullLosses").asLong() + row.get("halfLosses").asLong()).isEqualTo(row.get("losses").asLong());
    }
}
