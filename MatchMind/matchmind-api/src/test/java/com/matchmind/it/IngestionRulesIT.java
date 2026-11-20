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
    void spellingVariantsOfTheTeamsLandOnOneMatch() throws Exception { // UX-104
        String provider = newIntegration("rules-model").provider();
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        String matchId = null;
        for (String[] teams : new String[][]{{"Atlético Madrid " + suffix, "Real Betis"},
            {"ATLETICO  MADRID " + suffix + " FC", "real betis"}, {"Atlético Madrid " + suffix, "Real Betis CF"}}) {
            ObjectNode p = live();
            ObjectNode match = (ObjectNode) p.get("match");
            match.remove("externalMatchId");
            match.put("homeTeam", teams[0]).put("awayTeam", teams[1]);
            MvcResult res = send(provider, p);
            assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
            String got = read(res).get("matchId").asText();
            if (matchId == null) matchId = got;
            assertThat(got).as(teams[0]).isEqualTo(matchId);
        }
        assertThat(db.queryForObject("SELECT home_team FROM matches WHERE id = ?::uuid", String.class, matchId))
            .isEqualTo("Atlético Madrid " + suffix); // first spelling kept for display
    }

    @Test
    void sameExternalMatchIdWithOtherTeamsIsAConflict() throws Exception { // UX-045
        String provider = newIntegration("rules-model").provider();
        String ext = id("m");
        assertThat(send(provider, json.readTree(Payloads.livePrediction(id("e"), ext, "rules-model"))).getResponse().getStatus())
            .isEqualTo(201);

        ObjectNode other = (ObjectNode) json.readTree(Payloads.livePrediction(id("e"), ext, "rules-model"));
        ((ObjectNode) other.get("match")).put("homeTeam", "Totally Different Team");
        assertRejected(send(provider, other), 409, "MATCH_MISMATCH", "match.homeTeam");
        assertThat(db.queryForObject("SELECT home_team FROM matches WHERE external_match_id = ?", String.class, ext))
            .isEqualTo("Arsenal");

        ObjectNode variant = (ObjectNode) json.readTree(Payloads.livePrediction(id("e"), ext, "rules-model"));
        ((ObjectNode) variant.get("match")).put("homeTeam", "ARSENAL FC");
        assertThat(send(provider, variant).getResponse().getStatus()).isEqualTo(201);

        // A PRE_MATCH prediction after the stored kick-off (19:45) is refused even without startTime in the payload.
        ObjectNode late = (ObjectNode) json.readTree(Payloads.preMatchWithCorners(id("e"), ext, "rules-model", "HOME"));
        ObjectNode lateMatch = (ObjectNode) late.get("match");
        lateMatch.remove("startTime");
        lateMatch.put("homeTeam", "Arsenal").put("awayTeam", "Chelsea");
        late.put("predictedAt", "2026-11-10T21:00:00Z");
        assertRejected(send(provider, late), 400, "VALIDATION_ERROR", "predictedAt");
    }

    @Test
    void rescheduledPostponedMatchIsScheduledAgainWithHistory() throws Exception { // UX-105
        String provider = newIntegration("rules-model").provider();
        String ext = id("m");
        String first = Payloads.preMatchWithCorners(id("e"), ext, "rules-model", "HOME");
        assertThat(external(provider, "predictions", first).getResponse().getStatus()).isEqualTo(201);
        assertThat(external(provider, "matches/results", Payloads.result(ext, "POSTPONED", null, null, "2026-11-11T19:00:00Z"))
            .getResponse().getStatus()).isEqualTo(200);

        String moved = Payloads.preMatchWithCorners(id("e"), ext, "rules-model", "AWAY")
            .replace("\"startTime\": \"2026-11-11T20:00:00Z\"", "\"startTime\": \"2026-11-18T20:00:00Z\"");
        MvcResult res = external(provider, "predictions", moved);
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);

        String matchId = read(res).get("matchId").asText();
        var row = db.queryForMap("SELECT status, start_time FROM matches WHERE id = ?::uuid", matchId);
        assertThat(row.get("status")).isEqualTo("SCHEDULED");
        assertThat(((java.sql.Timestamp) row.get("start_time")).toInstant()).isEqualTo(java.time.Instant.parse("2026-11-18T20:00:00Z"));
        JsonNode history = adminGet("/api/v1/matches/" + matchId).get("resultHistory");
        assertThat(history.toString()).contains("2026-11-11T20:00:00Z", "2026-11-18T20:00:00Z", "POSTPONED", "SCHEDULED");
    }

    @Test
    void retryWithTheSameInstantWrittenDifferentlyIsADuplicate() throws Exception { // UX-106
        String provider = newIntegration("rules-model").provider();
        ObjectNode p = live();
        MvcResult first = send(provider, p);
        assertThat(first.getResponse().getStatus()).isEqualTo(201);

        ObjectNode retry = p.deepCopy();
        ((ObjectNode) retry.get("match")).put("startTime", "2026-11-11T02:45:00.000+07:00").put("homeTeam", "Arsenal ");
        retry.put("predictedAt", "2026-11-10T20:40:00.000Z");
        MvcResult again = send(provider, retry);
        assertThat(again.getResponse().getStatus()).as(again.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(read(again).get("predictionId")).isEqualTo(read(first).get("predictionId"));

        ObjectNode changed = p.deepCopy();
        changed.put("predictedAt", "2026-11-10T20:41:00Z");
        assertRejected(send(provider, changed), 409, "EVENT_ID_REUSED", null);
    }

    @Test
    void modelNamesAndVersionsFollowOneRule() throws Exception { // UX-108, UX-118, UX-017
        String provider = newIntegration("rules-model").provider();
        String[][] variants = {{"GPT-5.1", "1.0"}, {"gpt-5.1", "1"}, {" gpt-5.1 ", "1.00"}, {"Gpt-5.1", null}};
        for (String[] v : variants) {
            java.util.Map<String, String> headers = new java.util.HashMap<>(java.util.Map.of(
                "X-Api-Key", EXTERNAL_KEY, "X-Provider", provider, "X-Model-Name", v[0]));
            if (v[1] != null) headers.put("X-Model-Version", v[1]);
            MvcResult res = externalWith(headers, "predictions", Payloads.livePrediction(id("e"), id("m"), "ignored"));
            assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
        }
        assertThat(db.queryForList("SELECT m.name || '@' || m.version FROM ai_models m JOIN providers p ON p.id = m.provider_id "
            + "WHERE p.code = ?", String.class, provider)).containsExactly("GPT-5.1@1.0"); // first spelling kept

        externalWith(java.util.Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider, "X-Model-Name", "gpt-5.1",
            "X-Model-Version", "2"), "predictions", Payloads.livePrediction(id("e"), id("m"), "ignored"));
        assertThat(db.queryForObject("SELECT count(*) FROM ai_models m JOIN providers p ON p.id = m.provider_id WHERE p.code = ?",
            Integer.class, provider)).isEqualTo(2); // another version is another model
    }

    @Test
    void aRejectedRequestDoesNotCreateTheProvider() throws Exception { // UX-077
        String provider = newIntegration("rules-model").provider();
        ObjectNode bad = live();
        ((ObjectNode) bad.get("model")).put("name", "x".repeat(300));
        assertRejected(send(provider, bad), 400, "VALIDATION_ERROR", "model.name");
        assertRejected(external(provider, "matches/results", Payloads.result(id("m"), "FINISHED", "{\"home\":1,\"away\":0}",
            null, "2026-11-10T21:40:00Z")), 404, "MATCH_NOT_FOUND", null);
        assertRejected(external(provider, "predictions", "not json"), 400, "MALFORMED_REQUEST", null);
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Integer.class, provider)).isZero();

        // Still audited, without a provider row to point at.
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE request_status = 'REJECTED' "
            + "AND provider_id IS NULL AND event_id = ?", Integer.class, bad.get("eventId").asText())).isEqualTo(1);

        assertThat(send(provider, live()).getResponse().getStatus()).isEqualTo(201);
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Integer.class, provider)).isEqualTo(1);
    }

    @Test
    void sameContentUnderANewEventIdNamesTheEarlierPrediction() throws Exception { // UX-046
        String provider = newIntegration("rules-model").provider();
        ObjectNode p = live();
        MvcResult first = send(provider, p);
        assertThat(read(first).get("possibleDuplicateOf").isNull()).isTrue();

        ObjectNode again = p.deepCopy().put("eventId", id("e")).put("predictedAt", "2026-11-10T20:41:00Z");
        MvcResult second = send(provider, again);
        assertThat(second.getResponse().getStatus()).isEqualTo(201); // idempotency rules unchanged: stored as new
        assertThat(read(second).get("possibleDuplicateOf").asText()).isEqualTo(read(first).get("predictionId").asText());

        ObjectNode otherPick = p.deepCopy().put("eventId", id("e"));
        ((ObjectNode) otherPick.get("picks").get(0)).put("pick", "AWAY");
        assertThat(read(send(provider, otherPick)).get("possibleDuplicateOf").isNull()).isTrue();
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
