package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** UX-086: admin league aliases group variant league names under one canonical name in filters, dropdown and reports. */
class LeagueAliasIT extends IntegrationTestBase {

    private UUID seed(String provider, String league) throws Exception {
        String ext = "la-" + UUID.randomUUID();
        String body = Payloads.livePrediction("e-" + UUID.randomUUID(), ext, "la-model").replace("Premier League", league);
        assertThat(external(provider, "predictions", body).getResponse().getStatus()).isEqualTo(201);
        return db.queryForObject("SELECT id FROM providers WHERE code = ?", UUID.class, provider);
    }

    private MvcResult post(String url, String token, Object body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url)
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(body))).andReturn();
    }

    private int count(String url) throws Exception {
        return adminGet(url).get("meta").get("totalElements").asInt();
    }

    @Test
    void aliasGroupsVariantNamesUntilRemoved() throws Exception {
        String t = UUID.randomUUID().toString().substring(0, 8);
        String canonical = "English Premier League " + t, alias = "EPL " + t;
        String provider = "pl" + t;
        UUID pid = seed(provider, canonical);
        seed(provider, alias);
        assertThat(count("/api/v1/matches?providerId=" + pid + "&league=" + canonical)).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches/leagues")).extracting(JsonNode::asText).contains(alias); // fills the cache

        MvcResult created = post("/api/v1/leagues/aliases", adminToken,
            Map.of("alias", " epl " + t + " ", "canonical", canonical, "reason", "same league"));
        assertThat(created.getResponse().getStatus()).as(created.getResponse().getContentAsString()).isEqualTo(201);
        String id = read(created).get("id").asText();

        // Both names now select both matches, in lists and aggregates.
        assertThat(count("/api/v1/matches?providerId=" + pid + "&league=" + canonical)).isEqualTo(2);
        assertThat(count("/api/v1/matches?providerId=" + pid + "&league=" + alias)).isEqualTo(2);
        assertThat(count("/api/v1/predictions?providerId=" + pid + "&league=" + alias.toLowerCase())).isEqualTo(2);
        assertThat(adminGet("/api/v1/dashboard?countPolicy=all&providerId=" + pid + "&league=" + canonical).get("totals").get("totalPredictions").asInt())
            .isEqualTo(2);
        // The dropdown lists only the canonical name (the cache was evicted).
        JsonNode leagues = adminGet("/api/v1/matches/leagues");
        assertThat(leagues).extracting(JsonNode::asText).contains(canonical).doesNotContain(alias);
        // Reports group by the canonical name.
        JsonNode byLeague = adminGet("/api/v1/reports/breakdown?by=league&countPolicy=all&providerId=" + pid);
        assertThat(byLeague).hasSize(1);
        assertThat(byLeague.get(0).get("key").asText()).isEqualTo(canonical);
        assertThat(adminGet("/api/v1/leagues/aliases")).anySatisfy(a -> assertThat(a.get("id").asText()).isEqualTo(id));
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity = 'LEAGUE_ALIAS' AND action = 'MERGE'"
            + " AND entity_id = ?::uuid", Long.class, id)).isEqualTo(1);

        assertThat(post("/api/v1/leagues/aliases/" + id + "/remove", adminToken, Map.of("reason", "split again"))
            .getResponse().getStatus()).isEqualTo(204);
        assertThat(count("/api/v1/matches?providerId=" + pid + "&league=" + alias)).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches/leagues")).extracting(JsonNode::asText).contains(alias, canonical);
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity = 'LEAGUE_ALIAS' AND action = 'UNMERGE'"
            + " AND entity_id = ?::uuid", Long.class, id)).isEqualTo(1);
    }

    @Test
    void rejectsChainsDuplicatesSelfAliasesAndViewers() throws Exception {
        String t = UUID.randomUUID().toString().substring(0, 8);
        String a = "A league " + t, b = "B league " + t, c = "C league " + t;
        assertThat(post("/api/v1/leagues/aliases", adminToken, Map.of("alias", a, "canonical", b, "reason", "r"))
            .getResponse().getStatus()).isEqualTo(201);
        // Same alias again (any case/accents), an alias of an alias, a canonical that is an alias, an alias of itself.
        for (Map<String, String> bad : new Map[]{Map.of("alias", a.toUpperCase(), "canonical", c), Map.of("alias", b, "canonical", c),
            Map.of("alias", c, "canonical", a)}) {
            MvcResult res = post("/api/v1/leagues/aliases", adminToken, Map.of("alias", bad.get("alias"),
                "canonical", bad.get("canonical"), "reason", "r"));
            assertThat(res.getResponse().getStatus()).as(bad.toString()).isEqualTo(409);
            assertThat(read(res).get("code").asText()).isEqualTo("LEAGUE_ALIAS_CONFLICT");
        }
        MvcResult self = post("/api/v1/leagues/aliases", adminToken, Map.of("alias", "x " + t, "canonical", " X " + t, "reason", "r"));
        assertThat(self.getResponse().getStatus()).isEqualTo(400);
        assertThat(post("/api/v1/leagues/aliases", adminToken, Map.of("alias", "y " + t, "canonical", "z " + t, "reason", " "))
            .getResponse().getStatus()).isEqualTo(400);

        String viewer = "viewer-" + t;
        adminPost("/api/v1/users", Map.of("username", viewer, "password", "viewer-password-1", "role", "VIEWER"));
        String token = login(viewer, "viewer-password-1");
        assertThat(post("/api/v1/leagues/aliases", token, Map.of("alias", "v " + t, "canonical", "w " + t, "reason", "r"))
            .getResponse().getStatus()).isEqualTo(403);
        assertThat(post("/api/v1/leagues/aliases/" + UUID.randomUUID() + "/remove", adminToken, Map.of("reason", "r"))
            .getResponse().getStatus()).isEqualTo(404);
    }
}
