package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Agent API write-path rules (lane A backlog): time windows, text hygiene, picks, match identity, names. */
class IngestionRulesIT extends IntegrationTestBase {

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private ObjectNode live() throws Exception {
        return (ObjectNode) json.readTree(Payloads.livePrediction(id("e"), id("m"), "rules-model"));
    }

    private MvcResult send(String provider, JsonNode body) throws Exception {
        return external(provider, "predictions", json.writeValueAsString(body));
    }

    private void assertRejected(MvcResult res, int status, String code, String field) throws Exception {
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(status);
        JsonNode body = read(res);
        assertThat(body.get("code").asText()).isEqualTo(code);
        if (field != null) assertThat(body.toString()).contains(field);
    }

    @Test
    void epochNumbersAreNotTimestamps() throws Exception { // UX-084, UX-098
        String provider = newIntegration("rules-model").provider();
        ObjectNode a = live();
        ((ObjectNode) a.get("match")).put("startTime", 1796000000000L);
        assertRejected(send(provider, a), 400, "INVALID_FIELD_TYPE", "match.startTime");

        ObjectNode b = live();
        b.put("predictedAt", 1796000000L);
        assertRejected(send(provider, b), 400, "INVALID_FIELD_TYPE", "predictedAt");

        ObjectNode c = live();
        ((ObjectNode) c.get("odds").get(1)).put("capturedAt", 1796000000000L);
        assertRejected(send(provider, c), 400, "INVALID_FIELD_TYPE", "capturedAt");
    }

    @Test
    void timesOutsideTheWindowAreRejected() throws Exception { // UX-028, UX-098
        String provider = newIntegration("rules-model").provider();
        ObjectNode far = live();
        ((ObjectNode) far.get("match")).put("startTime", "+10000-01-01T00:00:00Z");
        assertRejected(send(provider, far), 400, "VALIDATION_ERROR", "match.startTime");

        ObjectNode ancient = live();
        ((ObjectNode) ancient.get("match")).put("startTime", "0001-01-01T00:00:00Z");
        assertRejected(send(provider, ancient), 400, "VALIDATION_ERROR", "match.startTime");

        ObjectNode future = live();
        future.put("predictedAt", "2036-11-20T17:00:00Z");
        assertRejected(send(provider, future), 400, "VALIDATION_ERROR", "predictedAt");
    }
}
