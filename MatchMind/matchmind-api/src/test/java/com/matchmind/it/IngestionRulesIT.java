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
    void controlAndDirectionCharactersAreRejectedWith400() throws Exception { // UX-029, UX-030, UX-096
        String provider = newIntegration("rules-model").provider();
        ObjectNode nul = live();
        ((ObjectNode) nul.get("match")).put("homeTeam", "Ars\u0000enal");
        assertRejected(send(provider, nul), 400, "VALIDATION_ERROR", "match.homeTeam");

        ObjectNode nulInMetadata = live();
        ((ObjectNode) nulInMetadata.get("metadata")).put("notes", "a\u0000b");
        assertRejected(send(provider, nulInMetadata), 400, "VALIDATION_ERROR", "metadata.notes");

        ObjectNode bidi = live();
        ((ObjectNode) bidi.get("match")).put("awayTeam", "\u202EaeslehC");
        assertRejected(send(provider, bidi), 400, "VALIDATION_ERROR", "match.awayTeam");

        String surrogate = Payloads.livePrediction(id("e"), id("m"), "rules-model").replace("\"Chelsea\"", "\"\\ud800\"");
        assertRejected(external(provider, "predictions", surrogate), 400, "VALIDATION_ERROR", "match.awayTeam");

        ObjectNode invisible = live();
        ((ObjectNode) invisible.get("match")).put("homeTeam", "\u200B\u200B");
        assertRejected(send(provider, invisible), 400, "VALIDATION_ERROR", "match.homeTeam");

        ObjectNode same = live();
        ((ObjectNode) same.get("match")).put("awayTeam", "ARSENAL ");
        assertRejected(send(provider, same), 400, "VALIDATION_ERROR", "match.awayTeam");
    }

    @Test
    void teamNamesAreStoredWithCollapsedWhitespace() throws Exception { // UX-096
        String provider = newIntegration("rules-model").provider();
        ObjectNode p = live();
        ((ObjectNode) p.get("match")).put("homeTeam", " Real\nMadrid\u00A0 B\u200B ");
        MvcResult res = send(provider, p);
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT home_team FROM matches WHERE id = ?::uuid", String.class,
            read(res).get("matchId").asText())).isEqualTo("Real Madrid B");
    }

    @Test
    void atMostTwoPicks() throws Exception { // UX-097
        ObjectNode p = live();
        com.fasterxml.jackson.databind.node.ArrayNode picks = (com.fasterxml.jackson.databind.node.ArrayNode) p.get("picks");
        picks.addObject().put("oddsRef", "1x2-open").put("market", "1X2").put("pick", "HOME").put("probability", 0.5).put("rank", 3);
        assertRejected(send(newIntegration("rules-model").provider(), p), 400, "VALIDATION_ERROR", "picks");
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
