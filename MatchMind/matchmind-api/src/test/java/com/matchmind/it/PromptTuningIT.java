package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.shared.Bands;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** GET /reports/prompt-tuning: settled picks grouped the ways a prompt rule can act on, and the rules checked. */
class PromptTuningIT extends IntegrationTestBase {

    private static JsonNode dimension(JsonNode report, String by) {
        for (JsonNode d : report.get("dimensions")) if (by.equals(d.get("by").asText())) return d.get("rows");
        throw new AssertionError("no dimension " + by);
    }

    private static List<String> keys(JsonNode rows) {
        List<String> keys = new ArrayList<>();
        rows.forEach(r -> keys.add(r.get("key").asText()));
        return keys;
    }

    private static JsonNode rule(JsonNode report, String id) {
        for (JsonNode r : report.get("rules")) if (id.equals(r.get("rule").asText())) return r;
        throw new AssertionError("no rule " + id);
    }

    private void settle(JsonNode prediction, Map<Integer, String> resultByRank) throws Exception {
        for (JsonNode pick : prediction.get("picks")) {
            adminPost("/api/v1/settlements/picks/" + pick.get("pickId").asText() + "/override",
                Map.of("result", resultByRank.get(pick.get("rank").asInt()), "reason", "prompt tuning test"));
        }
    }

    @Test
    void groupsSettledPicksAndChecksTheSelectionRules() throws Exception {
        Integration in = newIntegration("tuning");
        String id = UUID.randomUUID().toString().substring(0, 8);
        // Kick-offs a few days back: the picks stay inside TRACK RECORD's rolling 60 days whenever the suite runs.
        Instant liveKickOff = Instant.now().minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        Instant preKickOff = Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        // LIVE 55' at 1-0: rank 1 AH HOME -0.5 @1.95 p 0.58, rank 2 OU OVER 2.25 @1.85 p 0.54.
        JsonNode live = read(external(in.provider(), "predictions", Payloads.livePrediction("tl-" + id, "tl-" + id,
            in.modelName(), "Arsenal", "Chelsea " + id, "Premier League", liveKickOff)));
        // PRE_MATCH: rank 1 1X2 HOME @2.40 p 0.45, rank 2 CORNER_AH HOME -1.5 @1.95 p 0.52.
        JsonNode pre = read(external(in.provider(), "predictions", Payloads.preMatchWithCorners("tp-" + id, "tp-" + id,
                in.modelName(), "HOME").replace("2026-11-11T20:00:00Z", preKickOff.toString())
            .replace("2026-11-11T18:00:00Z", preKickOff.minus(2, ChronoUnit.HOURS).toString())));
        external(in.provider(), "matches/results", Payloads.result("tl-" + id, "FINISHED", "{\"home\":2,\"away\":1}", null,
            liveKickOff.plus(2, ChronoUnit.HOURS).toString()));
        external(in.provider(), "matches/results", Payloads.result("tp-" + id, "FINISHED", "{\"home\":1,\"away\":1}",
            "{\"home\":5,\"away\":4}", preKickOff.plus(2, ChronoUnit.HOURS).toString()));
        settle(live, Map.of(1, "WIN", 2, "LOSS"));
        settle(pre, Map.of(1, "LOSS", 2, "WIN"));
        String q = "?providerId=" + providerId(in);

        JsonNode report = adminGet("/api/v1/reports/prompt-tuning" + q);

        JsonNode total = report.get("total");
        assertThat(total.get("settled").asInt()).isEqualTo(4);
        assertThat(total.get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(total.get("units").decimalValue()).isEqualByComparingTo("-0.100"); // 0.95 - 1 - 1 + 0.95
        assertThat(total.get("hitRate").decimalValue()).isEqualByComparingTo("0.5");  // no half results: the win rate
        // Margin-free market probabilities 0.4935 (AH), 0.5195 (OU), 0.3914 (1X2), 0.4868 (corner AH).
        assertThat(total.get("avgMarketProbability").asDouble()).isCloseTo(0.4728, within(0.0005));

        assertThat(keys(dimension(report, "price"))).containsExactly("price 1.81-1.90", "price 1.91-2.05", "price above 2.05");
        JsonNode edges = dimension(report, "edge");
        // (stated - market) x price, the unit of the prompt's edge gate: OU 0.038, corner AH 0.065, 1X2 0.141, AH 0.169.
        assertThat(keys(edges)).containsExactly("edge 0 to 0.05", "edge 0.05 to 0.10", "edge 0.10 to 0.15", "edge above 0.15");
        assertThat(edges).allSatisfy(r -> assertThat(r.get("settled").asInt()).isEqualTo(1));
        assertThat(keys(dimension(report, "probability"))).containsExactly("stated below 0.55", "stated 0.55-0.59");
        assertThat(keys(dimension(report, "minute"))).containsExactly("pre-match", "live minute 31-60");
        assertThat(keys(dimension(report, "state"))).containsExactly("pre-match", "live, one goal apart");
        assertThat(keys(dimension(report, "line")))
            .containsExactlyInAnyOrder("AH half line", "OU quarter line", "1X2", "CORNER_AH half line");
        assertThat(keys(dimension(report, "rank"))).containsExactly("rank 1", "rank 2");
        assertThat(keys(dimension(report, "promptVersion"))).containsExactly("before the first saved version");
        assertThat(keys(dimension(report, "model"))).containsExactly(in.modelName() + " 1.0");

        JsonNode price = rule(report, "price");
        assertThat(price.get("follows").get("settled").asInt()).isEqualTo(1);  // OU OVER 1.85, lost
        assertThat(price.get("follows").get("wins").asInt()).isZero();
        assertThat(price.get("breaks").get("settled").asInt()).isEqualTo(3);
        assertThat(price.get("breaks").get("wins").asInt()).isEqualTo(2);
        JsonNode rank2 = rule(report, "rank2");
        assertThat(rank2.get("follows").get("settled").asInt()).isEqualTo(4);   // each rank 2 is in another market
        assertThat(rank2.get("breaks").isNull()).isTrue();
        // (stated - market) x price: AH 0.169 and 1X2 0.141 keep the 0.10 edge; OU 0.038 and corner AH 0.065 do not.
        JsonNode market = rule(report, "market");
        assertThat(market.get("follows").get("settled").asInt()).isEqualTo(2);
        assertThat(market.get("follows").get("wins").asInt()).isEqualTo(1);
        assertThat(market.get("breaks").get("settled").asInt()).isEqualTo(2);
        assertThat(market.get("breaks").get("wins").asInt()).isEqualTo(1);
        assertThat(rule(report, "all").get("follows").isNull()).isTrue();

        assertThat(report.get("text").asText()).contains("SELECTION RULES",
            "- Price above 1.65 and at most 1.90: followed won 0% of 1, ROI -100.0% | broken won 67% of 3, ROI +30.0%");

        // The result filter is ignored: the report is about settled picks.
        assertThat(adminGet("/api/v1/reports/prompt-tuning" + q + "&result=WIN").get("total").get("settled").asInt()).isEqualTo(4);
        MvcResult bad = mvc.perform(asAdmin(get("/api/v1/reports/prompt-tuning" + q + "&type=NOPE"))).andReturn();
        assertThat(bad.getResponse().getStatus()).isEqualTo(400);

        // The prompt's TRACK RECORD names the edge over the market and sets every group against the market.
        String promptId = db.queryForObject("SELECT id::text FROM prompt_templates WHERE template_type = 'AI_PREDICTION' "
            + "AND updated_by IS NULL ORDER BY created_at LIMIT 1", String.class);
        assertThat(adminGet("/api/v1/prompts/" + promptId + "/for-agent").get("content").asText())
            .contains("By your edge over the market").containsPattern("- By market and side: [^\\n]* vs market \\d+% \\(n \\d+\\)");
    }

    @Test
    void hitRateCountsWhatHalfResultsPaidBack() throws Exception {
        Integration in = newIntegration("tuning-hit");
        String id = UUID.randomUUID().toString().substring(0, 8);
        Instant kickOff = Instant.now().minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES);
        // Both sides of OU 2.25 (full match), so rank 2 is in rank 1's market: UNDER @2.00 p 0.50, OVER @1.85 p 0.54.
        String body = Payloads.livePrediction("th-" + id, "th-" + id, in.modelName(), "Arsenal", "Chelsea " + id,
                "Premier League", kickOff)
            .replace("{\"oddsRef\": \"ah-live\", \"market\": \"AH\", \"pick\": \"HOME\", \"probability\": 0.58, \"rank\": 1}",
                "{\"oddsRef\": \"ou-live\", \"market\": \"OU\", \"pick\": \"UNDER\", \"probability\": 0.50, \"rank\": 1}");
        external(in.provider(), "predictions", body);
        // 1-1 is two goals: UNDER 2.25 settles as a half win, OVER 2.25 as a half loss.
        external(in.provider(), "matches/results", Payloads.result("th-" + id, "FINISHED", "{\"home\":1,\"away\":1}", null,
            kickOff.plus(2, ChronoUnit.HOURS).toString()));

        JsonNode report = adminGet("/api/v1/reports/prompt-tuning?providerId=" + providerId(in));

        JsonNode total = report.get("total");
        assertThat(total.get("halfWins").asInt()).isEqualTo(1);
        assertThat(total.get("halfLosses").asInt()).isEqualTo(1);
        assertThat(total.get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        // What each paid back per unit of price: (1 + 0.5) / 2.00 = 0.75 and (1 - 0.5) / 1.85 = 0.2703.
        assertThat(total.get("hitRate").decimalValue()).isEqualByComparingTo("0.5101");
        assertThat(rule(report, "rank2").get("breaks").get("settled").asInt()).isEqualTo(1);
    }

    @Test
    void labelsThePromptVersionWithTheTemplateItBelongsTo() throws Exception {
        Integration in = newIntegration("tuning-version");
        String id = UUID.randomUUID().toString().substring(0, 8);
        // Kick-off an hour ago and no predictedAt: the server stamps the prediction now, after every seeded version.
        Instant kickOff = Instant.now().minus(60, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS);
        String body = Payloads.livePrediction("tv-" + id, "tv-" + id, in.modelName(), "Arsenal", "Chelsea " + id,
            "Premier League", kickOff).replaceFirst("\"predictedAt\": \"[^\"]+\",\\s*", "");
        JsonNode live = read(external(in.provider(), "predictions", body));
        external(in.provider(), "matches/results", Payloads.result("tv-" + id, "FINISHED", "{\"home\":2,\"away\":1}", null,
            Instant.now().minus(1, ChronoUnit.MINUTES).toString()));
        settle(live, Map.of(1, "WIN", 2, "LOSS"));

        JsonNode report = adminGet("/api/v1/reports/prompt-tuning?providerId=" + providerId(in));

        // Several AI_PREDICTION templates may exist: the key names the one whose version it is.
        assertThat(keys(dimension(report, "promptVersion")))
            .singleElement().asString().matches("AI Football Prediction Prompt v\\d+ \\(saved \\d{4}-\\d{2}-\\d{2}\\)");
    }

    @Test
    void rendersWhenNothingIsSettled() throws Exception {
        JsonNode report = adminGet("/api/v1/reports/prompt-tuning?search=nothing-" + UUID.randomUUID());
        assertThat(report.get("total").get("settled").asInt()).isZero();
        assertThat(report.get("total").get("winRate").isNull()).isTrue();
        assertThat(rule(report, "price").get("follows").isNull()).isTrue();
        assertThat(dimension(report, "price")).isEmpty();
        assertThat(report.get("text").asText()).contains("No settled picks match these filters");
    }

    @Test
    void bandSqlMatchesThePromptsBoundaries() {
        Map<String, String> price = Map.of("1.65", "1.65 or lower", "1.651", "1.66-1.80", "1.90", "1.81-1.90", "2.06", "above 2.05");
        price.forEach((v, label) -> assertThat(band(v, Bands.PRICE)).as(v).isEqualTo(label));
        Map<String, String> edge = Map.of("0", "0 or below", "0.10", "0.05 to 0.10", "0.1001", "0.10 to 0.15");
        edge.forEach((v, label) -> assertThat(band(v, Bands.EDGE)).as(v).isEqualTo(label));
        Map<String, String> probability = Map.of("0.5999", "0.55-0.59", "0.60", "0.60-0.64", "0.70", "0.70 or more");
        probability.forEach((v, label) -> assertThat(band(v, Bands.PROBABILITY)).as(v).isEqualTo(label));
    }

    private String band(String value, List<Bands.Band> bands) {
        return db.queryForObject("SELECT " + Bands.sql(value + "::numeric", bands), String.class);
    }
}
