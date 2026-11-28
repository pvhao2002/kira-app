package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PatternsReportIT extends IntegrationTestBase {

    @Test
    void patternsGroupEachPickByFactorAgainstTheOverallWinRate() throws Exception {
        Integration in = newIntegration("patterns");
        String live = "pt-" + UUID.randomUUID().toString().substring(0, 8), pre = "pt-" + UUID.randomUUID().toString().substring(0, 8);
        // LIVE at 55' 1-0: AH HOME -0.5 @1.95 p.58 rank 1 (forced WIN), OU OVER 2.25 @1.85 p.54 rank 2 (forced LOSS).
        JsonNode res = read(external(in.provider(), "predictions", Payloads.livePrediction("e-" + live, live, in.modelName())));
        external(in.provider(), "matches/results", Payloads.result(live, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        for (JsonNode pick : res.get("picks")) {
            adminPost("/api/v1/settlements/picks/" + pick.get("pickId").asText() + "/override",
                Map.of("result", pick.get("rank").asInt() == 1 ? "WIN" : "LOSS", "reason", "patterns test"));
        }
        // PRE_MATCH, pending: 1X2 HOME @2.40 p.45 rank 1 (no line), CORNER_AH HOME -1.5 @1.95 p.52 rank 2.
        external(in.provider(), "predictions", Payloads.preMatchWithCorners("e-" + pre, pre, in.modelName(), "HOME"));
        String q = "?providerId=" + providerId(in);

        JsonNode report = adminGet("/api/v1/reports/patterns" + q);
        JsonNode overall = report.get("overall");
        assertThat(overall.get("picks").asInt()).isEqualTo(4);
        assertThat(overall.get("wins").asInt()).isEqualTo(1);
        assertThat(overall.get("losses").asInt()).isEqualTo(1);
        assertThat(overall.get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(report.get("minSample").asInt()).isEqualTo(20);
        JsonNode rows = report.get("rows");

        JsonNode ahHome = row(rows, "side", "AH HOME");
        assertThat(ahHome.get("picks").asInt()).isEqualTo(1);
        assertThat(ahHome.get("winRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(ahHome.get("lift").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(ahHome.get("z").decimalValue()).isEqualByComparingTo("1.00");
        assertThat(ahHome.get("signal").isNull()).isTrue(); // 1 decisive pick < minSample

        assertThat(row(rows, "type", "LIVE").get("picks").asInt()).isEqualTo(2);
        assertThat(row(rows, "type", "PRE_MATCH").get("picks").asInt()).isEqualTo(2);
        assertThat(row(rows, "rank", "1").get("picks").asInt()).isEqualTo(2);
        assertThat(row(rows, "probability", "50-60%").get("picks").asInt()).isEqualTo(3);
        assertThat(row(rows, "probability", "40-50%").get("picks").asInt()).isEqualTo(1);
        assertThat(row(rows, "price", "1.91-2.05").get("picks").asInt()).isEqualTo(2);
        assertThat(row(rows, "price", "1.81-1.90").get("picks").asInt()).isEqualTo(1);
        assertThat(row(rows, "price", "above 2.05").get("picks").asInt()).isEqualTo(1);

        // Lines only where the odds have one: no 1X2 line row.
        assertThat(values(rows, "line")).containsExactlyInAnyOrder("AH HOME -0.5", "OU OVER 2.25", "CORNER_AH HOME -1.5");
        // Minute and score state are LIVE only.
        assertThat(values(rows, "minute")).containsExactly("46-60");
        assertThat(row(rows, "minute", "46-60").get("picks").asInt()).isEqualTo(2);
        assertThat(values(rows, "scoreState")).containsExactlyInAnyOrder("Pick side leading", "Not level");
        assertThat(row(rows, "scoreState", "Pick side leading").get("wins").asInt()).isEqualTo(1);
        assertThat(row(rows, "scoreState", "Not level").get("losses").asInt()).isEqualTo(1);

        assertThat(adminGet("/api/v1/reports/patterns" + q + "&minSample=0").get("minSample").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/reports/patterns" + q + "&minSample=5000").get("minSample").asInt()).isEqualTo(1000);
    }

    private static JsonNode row(JsonNode rows, String factor, String value) {
        for (JsonNode r : rows) {
            if (factor.equals(r.get("factor").asText()) && value.equals(r.get("value").asText())) return r;
        }
        throw new AssertionError("no row " + factor + "=" + value + " in " + rows);
    }

    private static List<String> values(JsonNode rows, String factor) {
        List<String> out = new ArrayList<>();
        rows.forEach(r -> { if (factor.equals(r.get("factor").asText())) out.add(r.get("value").asText()); });
        return out;
    }
}
