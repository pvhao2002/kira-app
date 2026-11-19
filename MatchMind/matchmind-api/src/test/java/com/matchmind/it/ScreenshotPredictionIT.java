package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Agents read matches off screenshots: no provider match id, no event id, no clock, and a LIVE screen shows the
 * minute instead of the kick-off time. Such predictions are still stored and land on the right match.
 */
class ScreenshotPredictionIT extends IntegrationTestBase {

    /** The live sample without anything a screenshot cannot show. */
    private ObjectNode screenshotLive(String home, String away, int minute, String pick) throws Exception {
        ObjectNode p = (ObjectNode) json.readTree(Payloads.livePrediction("unused", "unused", "unused"));
        p.remove(java.util.List.of("eventId", "model", "predictedAt"));
        ObjectNode match = (ObjectNode) p.get("match");
        match.remove(java.util.List.of("externalMatchId", "league", "startTime", "status"));
        match.put("homeTeam", home).put("awayTeam", away);
        p.put("matchMinute", minute);
        ((ObjectNode) p.get("picks").get(0)).put("pick", pick);
        return p;
    }

    private MvcResult send(String provider, ObjectNode body) throws Exception {
        return externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider, "X-Model-Name", "vision"),
            "predictions", json.writeValueAsString(body));
    }

    @Test
    void livePredictionWithoutIdsOrKickOffIsStoredOnOneMatch() throws Exception {
        String provider = newIntegration("vision").provider();
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        String home = "Home " + suffix, away = "Away " + suffix;

        Instant before = Instant.now();
        MvcResult first = send(provider, screenshotLive(home, away, 60, "HOME"));
        assertThat(first.getResponse().getStatus()).as(first.getResponse().getContentAsString()).isEqualTo(201);
        JsonNode created = read(first);
        assertThat(created.get("externalMatchId").asText()).startsWith("auto-");

        // Kick-off estimated from the minute (60' + 15' half-time), league unknown, received time as predictedAt.
        Map<String, Object> match = db.queryForMap("SELECT league, start_time, status FROM matches WHERE id = ?::uuid",
            created.get("matchId").asText());
        Instant kickOff = ((java.sql.Timestamp) match.get("start_time")).toInstant();
        assertThat(Duration.between(kickOff, before).toMinutes()).isBetween(74L, 76L);
        assertThat(match.get("league")).isEqualTo("Unknown league");
        assertThat(match.get("status")).isEqualTo("LIVE");
        Instant predictedAt = db.queryForObject("SELECT predicted_at FROM predictions WHERE id = ?::uuid",
            java.sql.Timestamp.class, created.get("predictionId").asText()).toInstant();
        assertThat(predictedAt).isBetween(before.minusSeconds(1), Instant.now());

        // The same screenshot sent again is a safe retry.
        MvcResult retry = send(provider, screenshotLive(home, away, 60, "HOME"));
        assertThat(retry.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(retry).get("predictionId").asText()).isEqualTo(created.get("predictionId").asText());

        // A later screenshot of the same game lands on the same match, and keeps its kick-off time.
        MvcResult later = send(provider, screenshotLive(home, away, 70, "AWAY"));
        assertThat(later.getResponse().getStatus()).as(later.getResponse().getContentAsString()).isEqualTo(201);
        assertThat(read(later).get("matchId").asText()).isEqualTo(created.get("matchId").asText());
        Instant keptKickOff = db.queryForObject("SELECT start_time FROM matches WHERE id = ?::uuid",
            java.sql.Timestamp.class, created.get("matchId").asText()).toInstant();
        assertThat(keptKickOff).isEqualTo(kickOff);
    }

    @Test
    void teamsAreStillRequired() throws Exception {
        ObjectNode body = screenshotLive("X", "Y", 30, "HOME");
        ((ObjectNode) body.get("match")).remove("homeTeam");
        MvcResult res = send(newIntegration("vision").provider(), body);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(res).toString()).contains("homeTeam");
    }
}
