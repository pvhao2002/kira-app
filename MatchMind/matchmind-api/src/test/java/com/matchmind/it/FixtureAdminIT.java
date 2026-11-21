package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.matchmind.it.FixtureLinkIT.KICK_OFF;
import static com.matchmind.it.FixtureLinkIT.uniq;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Admin merge / unlink / suggestions / backfill of fixtures, and result sharing across fixture members (owner decisions
 * 3 phase 2 and 4). Predictions and settlement rows never change on a merge or unlink.
 */
class FixtureAdminIT extends IntegrationTestBase {
    private static final String TWO_ONE = "{\"home\":2,\"away\":1}";
    private static final String ONE_ONE = "{\"home\":1,\"away\":1}";

    private record Seeded(UUID matchId, String ext) {
    }

    private Seeded ingest(String provider, String home, String away, Instant start) throws Exception {
        String ext = "fa-" + uniq();
        MvcResult res = external(provider, "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), ext, "model-" + provider, home, away, "League", start));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isIn(200, 201);
        return new Seeded(db.queryForObject("SELECT m.id FROM matches m JOIN providers p ON p.id = m.provider_id"
            + " WHERE p.code = ? AND m.external_match_id = ?", UUID.class, provider, ext), ext);
    }

    private UUID fixtureOf(UUID matchId) {
        return db.queryForObject("SELECT fixture_id FROM matches WHERE id = ?", UUID.class, matchId);
    }

    private MvcResult send(String url, String token, Object body) throws Exception {
        return mvc.perform(post(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn();
    }

    private String viewerToken() throws Exception {
        String name = "viewer-" + uniq();
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        return login(name, "viewer-password-1");
    }

    private String snapshotOfPredictions(UUID... matchIds) {
        String ids = String.join(",", java.util.Arrays.stream(matchIds).map(id -> "'" + id + "'").toList());
        return db.queryForObject("SELECT count(*) || ':' || COALESCE(string_agg(p.payload_hash, ',' ORDER BY p.id), '')"
            + " || ':' || (SELECT count(*) FROM prediction_pick_results r JOIN prediction_picks k ON k.id = r.pick_id"
            + " JOIN predictions q ON q.id = k.prediction_id WHERE q.match_id IN (" + ids + "))"
            + " FROM predictions p WHERE p.match_id IN (" + ids + ")", String.class);
    }

    @Test
    void viewerCannotMergeUnlinkOrBackfill() throws Exception {
        String viewer = viewerToken();
        UUID any = UUID.randomUUID();
        assertThat(send("/api/v1/fixtures/merge", viewer, Map.of("matchIds", List.of(any, UUID.randomUUID()), "reason", "x"))
            .getResponse().getStatus()).isEqualTo(403);
        assertThat(send("/api/v1/matches/" + any + "/unlink", viewer, Map.of("reason", "x")).getResponse().getStatus()).isEqualTo(403);
        assertThat(send("/api/v1/fixtures/backfill", viewer, Map.of()).getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void reasonAndTwoMatchesAreRequired() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Ants " + t, "Bees " + t, KICK_OFF).matchId();
        UUID b = ingest("pb" + t, "Ants " + t, "Bees " + t, KICK_OFF.plus(Duration.ofDays(1))).matchId();
        MvcResult noReason = send("/api/v1/fixtures/merge", adminToken, Map.of("matchIds", List.of(a, b), "reason", " "));
        assertThat(noReason.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(noReason).get("code").asText()).isEqualTo("VALIDATION_ERROR");
        MvcResult one = send("/api/v1/fixtures/merge", adminToken, Map.of("matchIds", List.of(a, a), "reason", "same"));
        assertThat(one.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(one).get("code").asText()).isEqualTo("VALIDATION_ERROR");
        MvcResult unlink = send("/api/v1/matches/" + a + "/unlink", adminToken, Map.of());
        assertThat(unlink.getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void mergeAndUnlinkNeverTouchPredictionsOrSettlement() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Owls " + t, "Doves " + t, KICK_OFF).matchId();
        UUID b = ingest("pb" + t, "Owl " + t, "Doves " + t, KICK_OFF).matchId();
        assertThat(fixtureOf(a)).isNotEqualTo(fixtureOf(b));
        String before = snapshotOfPredictions(a, b);

        JsonNode merged = adminPost("/api/v1/fixtures/merge", Map.of("matchIds", List.of(a, b), "reason", "Owl is Owls"));
        assertThat(fixtureOf(a)).isEqualTo(fixtureOf(b)).hasToString(merged.get("id").asText());
        assertThat(merged.get("members")).hasSize(2);
        assertThat(db.queryForObject("SELECT count(*) FROM fixture_link_history WHERE source = 'ADMIN_MERGE' AND match_id IN (?, ?)",
            Long.class, a, b)).isEqualTo(1);
        assertThat(snapshotOfPredictions(a, b)).isEqualTo(before);

        // Model comparison: one fixture row with both providers' models.
        JsonNode cmp = adminGet("/api/v1/reports/model-comparison?minModels=2&search=" + t);
        assertThat(cmp.get("data")).hasSize(1);
        assertThat(cmp.get("data").get(0).get("models")).hasSize(2);

        adminPost("/api/v1/matches/" + b + "/unlink", Map.of("reason", "different game"));
        assertThat(fixtureOf(b)).isNotNull().isNotEqualTo(fixtureOf(a));
        assertThat(adminGet("/api/v1/reports/model-comparison?minModels=2&search=" + t).get("data")).isEmpty();
        assertThat(snapshotOfPredictions(a, b)).isEqualTo(before);
    }

    @Test
    void mergingFixturesWithDifferentResultsShowsMismatchAndOverwritesNothing() throws Exception {
        String t = uniq();
        Seeded a = ingest("pa" + t, "Elks " + t, "Yaks " + t, KICK_OFF);
        Seeded b = ingest("pb" + t, "Elk " + t, "Yaks " + t, KICK_OFF);
        external("pa" + t, "matches/results", Payloads.result(a.ext(), "FINISHED", TWO_ONE, null, "2026-11-08T17:00:00Z"));
        external("pb" + t, "matches/results", Payloads.result(b.ext(), "FINISHED", ONE_ONE, null, "2026-11-08T17:00:00Z"));

        JsonNode merged = adminPost("/api/v1/fixtures/merge", Map.of("matchIds", List.of(a.matchId(), b.matchId()), "reason", "same game"));
        assertThat(merged.get("resultMismatch").asBoolean()).isTrue();
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, a.matchId())).isEqualTo(2);
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, b.matchId())).isEqualTo(1);
        JsonNode row = adminGet("/api/v1/reports/model-comparison?minModels=2&search=" + t).get("data").get(0);
        assertThat(row.get("resultMismatch").asBoolean()).isTrue();
    }

    @Test
    void trustedResultPropagatesToEveryMember() throws Exception {
        String t = uniq();
        Seeded a = ingest("pa" + t, "Rams " + t, "Bulls " + t, KICK_OFF);
        Seeded b = ingest("pb" + t, "Rams " + t, "Bulls " + t, KICK_OFF);
        assertThat(fixtureOf(a.matchId())).isEqualTo(fixtureOf(b.matchId()));

        // A per-provider key holding the RESULTS scope is a trusted source.
        String key = resultsKey("pa" + t);
        JsonNode res = read(externalWith(Map.of("X-Api-Key", key), "matches/results",
            Payloads.result(a.ext(), "FINISHED", TWO_ONE, null, "2026-11-08T17:00:00Z")));
        assertThat(res.get("propagatedTo")).hasSize(1);
        assertThat(db.queryForObject("SELECT status || ' ' || final_home_score || '-' || final_away_score FROM matches WHERE id = ?",
            String.class, b.matchId())).isEqualTo("FINISHED 2-1");
        assertThat(db.queryForObject("SELECT count(*) FROM match_result_history WHERE match_id = ? AND new_result->>'propagatedFrom' = ?",
            Long.class, b.matchId(), a.matchId().toString())).isEqualTo(1);
        assertThat(db.queryForObject("""
            SELECT count(*) FROM prediction_pick_results r JOIN prediction_picks k ON k.id = r.pick_id
            JOIN predictions p ON p.id = k.prediction_id WHERE p.match_id = ? AND r.is_current AND r.result <> 'PENDING'""",
            Long.class, b.matchId())).isPositive();

        // An admin correction on b flows back to a, one history row each.
        adminPost("/api/v1/matches/" + b.matchId() + "/result", Map.of("status", "FINISHED",
            "finalScore", Map.of("home", 1, "away", 1), "reason", "wrong score"));
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, a.matchId())).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches/" + a.matchId()).get("fixture").get("resultMismatch").asBoolean()).isFalse();
    }

    @Test
    void legacyKeyResultStaysWithItsOwnProvider() throws Exception {
        String t = uniq();
        Seeded a = ingest("pa" + t, "Hens " + t, "Foxes " + t, KICK_OFF);
        Seeded b = ingest("pb" + t, "Hens " + t, "Foxes " + t, KICK_OFF);
        assertThat(fixtureOf(a.matchId())).isEqualTo(fixtureOf(b.matchId()));

        // The legacy shared key may still post its own result, but it is not a trusted source for other providers.
        MvcResult res = external("pa" + t, "matches/results", Payloads.result(a.ext(), "FINISHED", TWO_ONE, null, "2026-11-08T17:00:00Z"));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(read(res).get("propagatedTo")).isEmpty();
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, a.matchId())).isEqualTo(2);
        assertThat(db.queryForObject("SELECT status FROM matches WHERE id = ?", String.class, b.matchId())).isNotEqualTo("FINISHED");
        assertThat(db.queryForObject("SELECT count(*) FROM match_result_history WHERE match_id = ?", Long.class, b.matchId())).isZero();

        // b's own legacy agent reports a different score: each keeps its own and the fixture shows the mismatch.
        assertThat(read(external("pb" + t, "matches/results", Payloads.result(b.ext(), "FINISHED", ONE_ONE, null,
            "2026-11-08T17:30:00Z"))).get("propagatedTo")).isEmpty();
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, a.matchId())).isEqualTo(2);
        assertThat(adminGet("/api/v1/matches/" + a.matchId()).get("fixture").get("resultMismatch").asBoolean()).isTrue();
    }

    /** Issues a per-provider key with the RESULTS scope for an existing provider code. */
    private String resultsKey(String providerCode) throws Exception {
        UUID id = db.queryForObject("SELECT id FROM providers WHERE code = ?", UUID.class, providerCode);
        return adminPost("/api/v1/providers/" + id + "/keys", Map.of("label", "feeder", "scopes", List.of("PREDICTIONS", "RESULTS")))
            .get("apiKey").asText();
    }

    @Test
    void sameProviderSiblingsShareResult() throws Exception {
        String t = uniq();
        String p = "pa" + t;
        Seeded a = ingest(p, "Cats " + t, "Dogs " + t, KICK_OFF);
        Seeded b = ingest(p, "Cats " + t, "Dogs " + t + " FC", KICK_OFF.plus(Duration.ofHours(1)));
        assertThat(a.matchId()).isNotEqualTo(b.matchId());
        assertThat(fixtureOf(a.matchId())).isEqualTo(fixtureOf(b.matchId()));

        external(p, "matches/results", Payloads.result(a.ext(), "FINISHED", TWO_ONE, null, "2026-11-08T18:00:00Z"));
        assertThat(db.queryForObject("SELECT final_home_score FROM matches WHERE id = ?", Integer.class, b.matchId())).isEqualTo(2);
        assertThat(db.queryForObject("SELECT count(*) FROM match_result_history WHERE match_id = ?", Long.class, b.matchId())).isEqualTo(1);
    }

    @Test
    void suggestionsListNearMatchesAndBackfillIsIdempotent() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Manchester United " + t, "Leeds " + t, KICK_OFF).matchId();
        UUID b = ingest("pb" + t, "Manchester Utd " + t, "Leeds " + t, KICK_OFF.plus(Duration.ofHours(1))).matchId();
        assertThat(fixtureOf(a)).isNotEqualTo(fixtureOf(b));
        JsonNode page = adminGet("/api/v1/fixtures/suggestions?size=100");
        boolean found = false;
        for (JsonNode s : page.get("data")) {
            String x = s.get("a").get("matchId").asText(), y = s.get("b").get("matchId").asText();
            if ((x.equals(a.toString()) && y.equals(b.toString())) || (x.equals(b.toString()) && y.equals(a.toString()))) found = true;
        }
        assertThat(found).as(page.toString()).isTrue();

        // Backfill links rows that predate the fixture layer.
        UUID provider = db.queryForObject("SELECT provider_id FROM matches WHERE id = ?", UUID.class, a);
        UUID legacy = db.queryForObject("""
            INSERT INTO matches (provider_id, external_match_id, league, home_team, away_team, start_time, status)
            VALUES (?, ?, 'League', ?, ?, ?, 'SCHEDULED') RETURNING id""", UUID.class, provider, "legacy-" + t,
            "Manchester United " + t, "Leeds " + t, java.sql.Timestamp.from(KICK_OFF.plus(Duration.ofHours(2))));
        assertThat(fixtureOf(legacy)).isNull();
        assertThat(adminPost("/api/v1/fixtures/backfill", Map.of()).get("linked").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(fixtureOf(legacy)).isEqualTo(fixtureOf(a));
        assertThat(adminPost("/api/v1/fixtures/backfill", Map.of()).get("linked").asLong()).isZero();
    }
}
