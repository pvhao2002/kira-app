package com.matchmind.it;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cross-provider match identity: a match is auto-linked on ingest to the fixture with the same normalised teams and a
 * kick-off within ±6 h. Every test uses its own team names, so other tests' Arsenal-Chelsea fixture never interferes.
 */
class FixtureLinkIT extends IntegrationTestBase {
    static final Instant KICK_OFF = Instant.parse("2026-11-08T15:00:00Z");

    static String uniq() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    /** Sends one LIVE prediction and returns the match row id. */
    UUID ingest(String provider, String home, String away, String league, Instant start) throws Exception {
        String ext = "fx-" + uniq();
        var res = external(provider, "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), ext, "model-" + provider, home, away, league, start));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isIn(200, 201);
        return db.queryForObject("SELECT m.id FROM matches m JOIN providers p ON p.id = m.provider_id"
            + " WHERE p.code = ? AND m.external_match_id = ?", UUID.class, provider, ext);
    }

    UUID fixtureOf(UUID matchId) {
        return db.queryForObject("SELECT fixture_id FROM matches WHERE id = ?", UUID.class, matchId);
    }

    @Test
    void twoProvidersSameFixtureShareOneFixture() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Lions " + t, "Tigers " + t, "Premier League", KICK_OFF);
        UUID b = ingest("pb" + t, "Lions " + t, "Tigers " + t, "English Premier League", KICK_OFF.plus(Duration.ofHours(2)));
        assertThat(fixtureOf(a)).isNotNull().isEqualTo(fixtureOf(b));
        assertThat(db.queryForObject("SELECT count(*) FROM fixture_link_history WHERE match_id IN (?, ?) AND source = 'AUTO'",
            Long.class, a, b)).isEqualTo(2);
    }

    @Test
    void concurrentFirstCallbacksCreateOneFixture() throws Exception {
        String t = uniq();
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Callable<UUID>> calls = List.of("p1", "p2", "p3", "p4").stream().<Callable<UUID>>map(p -> () -> {
                go.await();
                return ingest(p + t, "Hawks " + t, "Owls " + t, "Unknown league", KICK_OFF);
            }).toList();
            List<Future<UUID>> futures = calls.stream().map(pool::submit).toList();
            go.countDown();
            List<UUID> fixtures = new java.util.ArrayList<>();
            for (Future<UUID> f : futures) fixtures.add(fixtureOf(f.get()));
            assertThat(fixtures).doesNotContainNull().containsOnly(fixtures.getFirst());
        } finally {
            pool.shutdownNow();
        }
        assertThat(db.queryForObject("SELECT count(*) FROM fixtures WHERE norm_home = ?", Long.class, "hawks " + t)).isEqualTo(1);
    }

    @Test
    void sameTeamsThreeDaysLaterIsNewFixture() throws Exception {
        String t = uniq();
        UUID first = ingest("pa" + t, "Foxes " + t, "Wolves " + t, "Cup", KICK_OFF);
        UUID replay = ingest("pb" + t, "Foxes " + t, "Wolves " + t, "Cup", KICK_OFF.plus(Duration.ofDays(3)));
        UUID late = ingest("pc" + t, "Foxes " + t, "Wolves " + t, "Cup", KICK_OFF.plus(Duration.ofHours(7)));
        assertThat(fixtureOf(first)).isNotEqualTo(fixtureOf(replay));
        assertThat(fixtureOf(late)).as("±6 h window, never by date").isNotEqualTo(fixtureOf(first));
    }

    @Test
    void spellingVariantsLink() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Atlético " + t, "Bärsa " + t + " FC", "Unknown league", KICK_OFF);
        UUID b = ingest("pb" + t, "ATLETICO  " + t, "barsa " + t, "La Liga", KICK_OFF.minus(Duration.ofHours(1)));
        assertThat(fixtureOf(a)).isNotNull().isEqualTo(fixtureOf(b));
    }

    @Test
    void swappedHomeAndAwayIsNotLinked() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Reds " + t, "Blues " + t, "League", KICK_OFF);
        UUID b = ingest("pb" + t, "Blues " + t, "Reds " + t, "League", KICK_OFF);
        assertThat(fixtureOf(a)).isNotEqualTo(fixtureOf(b));
    }

    @Test
    void matchDetailShowsFixtureMembers() throws Exception {
        String t = uniq();
        UUID a = ingest("pa" + t, "Kites " + t, "Crows " + t, "League", KICK_OFF);
        ingest("pb" + t, "Kites " + t, "Crows " + t, "League", KICK_OFF);
        var fixture = adminGet("/api/v1/matches/" + a).get("fixture");
        assertThat(fixture.get("id").asText()).isEqualTo(fixtureOf(a).toString());
        assertThat(fixture.get("members")).hasSize(2);
        assertThat(fixture.get("resultMismatch").asBoolean()).isFalse();
    }

    @Test
    void latePicksForAFinalGameUnderAnotherIdAreRejected() throws Exception {
        String t = uniq();
        String ext = "fx-" + uniq();
        var first = external("pa" + t, "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), ext, "model-a", "Bats " + t, "Moles " + t, "League", KICK_OFF));
        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        external("pa" + t, "matches/results", Payloads.result(ext, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-08T17:00:00Z"));

        // Another provider sends picks for the same, already finished game under its own new externalMatchId.
        String late = "fx-" + uniq();
        var res = external("pb" + t, "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), late, "model-b", "Bats " + t, "Moles " + t, "League", KICK_OFF));
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(409);
        assertThat(read(res).get("code").asText()).isEqualTo("MATCH_ALREADY_FINAL");
        assertThat(db.queryForObject("SELECT count(*) FROM matches WHERE external_match_id = ?", Long.class, late)).isZero();
    }
}
