package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Admin API: archive / unarchive (providers, models, matches), rename, merge / unmerge (models) and the users status
 * filter. Every write needs ADMIN and a reason, and leaves one admin_actions row.
 * Every livePrediction settles to wins/losses by final score: 3-0 gives 2 wins 0 losses, 1-0 gives 0 wins 2 losses.
 */
class AdminArchiveMergeIT extends IntegrationTestBase {
    private static final String WIN_2_0 = "{\"home\":3,\"away\":0}";
    private static final String LOSS_0_2 = "{\"home\":1,\"away\":0}";

    private record Seed(UUID modelId, UUID matchId, UUID predictionId) {
    }

    private Seed seed(String provider, String model, String finalScore, String league) throws Exception {
        String match = "aa-" + UUID.randomUUID().toString().substring(0, 8);
        String body = Payloads.livePrediction("e-" + UUID.randomUUID(), match, model);
        external(provider, "predictions", league == null ? body : body.replace("Premier League", league));
        external(provider, "matches/results", Payloads.result(match, "FINISHED", finalScore, null, "2026-11-10T21:40:00Z"));
        return new Seed(
            db.queryForObject("""
                SELECT m.id FROM ai_models m JOIN providers p ON p.id = m.provider_id
                WHERE p.code = ? AND m.name = ?""", UUID.class, provider, model),
            db.queryForObject("""
                SELECT m.id FROM matches m JOIN providers p ON p.id = m.provider_id
                WHERE p.code = ? AND m.external_match_id = ?""", UUID.class, provider, match),
            db.queryForObject("""
                SELECT pr.id FROM predictions pr JOIN matches m ON m.id = pr.match_id JOIN providers p ON p.id = m.provider_id
                WHERE p.code = ? AND m.external_match_id = ?""", UUID.class, provider, match));
    }

    private Seed seed(String provider, String model, String finalScore) throws Exception {
        return seed(provider, model, finalScore, null);
    }

    private MvcResult send(HttpMethod method, String url, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder b = request(method, url).contentType(MediaType.APPLICATION_JSON)
            .content(body instanceof String s ? s : json.writeValueAsString(body));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return mvc.perform(b).andReturn();
    }

    private MvcResult asAdmin(HttpMethod method, String url, Object body) throws Exception {
        return send(method, url, adminToken, body);
    }

    private JsonNode ok(MvcResult res) throws Exception {
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        return read(res);
    }

    private String viewerToken() throws Exception {
        String name = "viewer-" + UUID.randomUUID().toString().substring(0, 8);
        adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        return login(name, "viewer-password-1");
    }

    private static JsonNode byId(JsonNode rows, UUID id) {
        for (JsonNode n : rows) if (id.toString().equals(n.get("id").asText())) return n;
        return null;
    }

    private static JsonNode byModelId(JsonNode rows, UUID id) {
        for (JsonNode n : rows) if (id.toString().equals(n.get("modelId").asText())) return n;
        return null;
    }

    private long actions(String entity, UUID id, String action) {
        return db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity = ? AND entity_id = ? AND action = ?",
            Long.class, entity, id, action);
    }

    private void assertCode(MvcResult res, int status, String code) throws Exception {
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(status);
        assertThat(read(res).get("code").asText()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ authorisation and validation

    @Test
    void viewerCannotWriteAndReasonIsRequired() throws Exception {
        Integration in = newIntegration("authz");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        UUID providerId = providerId(in);
        String viewer = viewerToken();
        String[][] writes = {
            {"POST", "/api/v1/providers/" + providerId + "/archive"}, {"POST", "/api/v1/providers/" + providerId + "/unarchive"},
            {"POST", "/api/v1/models/" + s.modelId() + "/archive"}, {"POST", "/api/v1/models/" + s.modelId() + "/unarchive"},
            {"POST", "/api/v1/matches/" + s.matchId() + "/archive"}, {"POST", "/api/v1/matches/" + s.matchId() + "/unarchive"},
            {"POST", "/api/v1/models/" + s.modelId() + "/unmerge"}, {"PATCH", "/api/v1/models/" + s.modelId()}};
        for (String[] w : writes) {
            assertThat(send(HttpMethod.valueOf(w[0]), w[1], viewer, Map.of("reason", "x", "displayName", "y"))
                .getResponse().getStatus()).as(w[1]).isEqualTo(403);
            // Admin without a reason or with a blank one: 400 and nothing changed.
            assertCode(asAdmin(HttpMethod.valueOf(w[0]), w[1], Map.of("displayName", "y")), 400, "VALIDATION_ERROR");
            assertCode(asAdmin(HttpMethod.valueOf(w[0]), w[1], Map.of("reason", "   ", "displayName", "y")), 400, "VALIDATION_ERROR");
        }
        assertThat(send(HttpMethod.POST, "/api/v1/models/" + s.modelId() + "/merge", viewer,
            Map.of("targetModelId", s.modelId(), "reason", "x")).getResponse().getStatus()).isEqualTo(403);
        assertCode(asAdmin(HttpMethod.POST, "/api/v1/models/" + s.modelId() + "/merge", Map.of("targetModelId", s.modelId())),
            400, "VALIDATION_ERROR");
        assertCode(asAdmin(HttpMethod.POST, "/api/v1/models/" + s.modelId() + "/merge", Map.of("reason", "x")), 400, "VALIDATION_ERROR");
        assertThat(db.queryForObject("SELECT count(*) FROM admin_actions WHERE entity_id IN (?, ?, ?)", Long.class,
            providerId, s.modelId(), s.matchId())).isZero();
    }

    @Test
    void unknownIdIs404() throws Exception {
        String body = "{\"reason\":\"x\"}";
        for (String path : new String[] {"providers", "models", "matches"}) {
            assertCode(asAdmin(HttpMethod.POST, "/api/v1/" + path + "/" + UUID.randomUUID() + "/archive", body), 404, path.equals("models")
                ? "MODEL_NOT_FOUND" : path.equals("matches") ? "MATCH_NOT_FOUND" : "PROVIDER_NOT_FOUND");
        }
    }

    // ------------------------------------------------------------------ archive

    @Test
    void archiveProviderHidesItAndEvictsLeagues() throws Exception {
        Integration in = newIntegration("arch-prov");
        String league = "Zeta " + UUID.randomUUID();
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0, league);
        UUID providerId = providerId(in);
        assertThat(adminGet("/api/v1/matches/leagues").toString()).contains(league); // fills the cache

        JsonNode view = ok(asAdmin(HttpMethod.POST, "/api/v1/providers/" + providerId + "/archive", Map.of("reason", " wrong feed ")));
        assertThat(view.get("id").asText()).isEqualTo(providerId.toString());
        assertThat(view.get("archivedAt").isNull()).isFalse();

        assertThat(byId(adminGet("/api/v1/providers"), providerId)).isNull();
        assertThat(byId(adminGet("/api/v1/models"), s.modelId())).isNull();
        assertThat(adminGet("/api/v1/matches/leagues").toString()).doesNotContain(league);
        assertThat(db.queryForMap("SELECT reason, actor, entity, action FROM admin_actions WHERE entity_id = ?", providerId))
            .containsEntry("reason", "wrong feed").containsEntry("entity", "PROVIDER").containsEntry("action", "ARCHIVE")
            .containsEntry("actor", db.queryForObject("SELECT id FROM users WHERE username = ?", UUID.class, ADMIN));

        // Archiving again is a no-op: 200, same view, no second audit row.
        JsonNode again = ok(asAdmin(HttpMethod.POST, "/api/v1/providers/" + providerId + "/archive", Map.of("reason", "again")));
        assertThat(again.get("archivedAt").asText()).isEqualTo(view.get("archivedAt").asText());
        assertThat(actions("PROVIDER", providerId, "ARCHIVE")).isEqualTo(1);

        JsonNode restored = ok(asAdmin(HttpMethod.POST, "/api/v1/providers/" + providerId + "/unarchive", Map.of("reason", "was fine")));
        assertThat(restored.get("archivedAt").isNull()).isTrue();
        assertThat(byId(adminGet("/api/v1/providers"), providerId)).isNotNull();
        assertThat(byId(adminGet("/api/v1/models"), s.modelId())).isNotNull();
        assertThat(adminGet("/api/v1/matches/leagues").toString()).contains(league);
        assertThat(actions("PROVIDER", providerId, "UNARCHIVE")).isEqualTo(1);

        // Unarchiving something that is not archived changes nothing.
        ok(asAdmin(HttpMethod.POST, "/api/v1/providers/" + providerId + "/unarchive", Map.of("reason", "again")));
        assertThat(actions("PROVIDER", providerId, "UNARCHIVE")).isEqualTo(1);
    }

    @Test
    void archiveMatchEvictsLeaguesAndReturnsDetail() throws Exception {
        Integration in = newIntegration("arch-match");
        String league = "Omega " + UUID.randomUUID();
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0, league);
        assertThat(adminGet("/api/v1/matches/leagues").toString()).contains(league);

        JsonNode detail = ok(asAdmin(HttpMethod.POST, "/api/v1/matches/" + s.matchId() + "/archive", Map.of("reason", "test match")));
        assertThat(detail.get("match").get("id").asText()).isEqualTo(s.matchId().toString());
        assertThat(adminGet("/api/v1/matches/leagues").toString()).doesNotContain(league);
        assertThat(adminGet("/api/v1/matches?providerId=" + providerId(in)).get("meta").get("totalElements").asInt()).isZero();
        assertThat(actions("MATCH", s.matchId(), "ARCHIVE")).isEqualTo(1);

        ok(asAdmin(HttpMethod.POST, "/api/v1/matches/" + s.matchId() + "/unarchive", Map.of("reason", "real match")));
        assertThat(adminGet("/api/v1/matches/leagues").toString()).contains(league);
        assertThat(actions("MATCH", s.matchId(), "UNARCHIVE")).isEqualTo(1);
    }

    @Test
    void archiveModelHidesItFromLists() throws Exception {
        Integration in = newIntegration("arch-model");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        UUID providerId = providerId(in);

        JsonNode view = ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + s.modelId() + "/archive", Map.of("reason", "junk")));
        assertThat(view.get("archivedAt").isNull()).isFalse();
        assertThat(byId(adminGet("/api/v1/models?providerId=" + providerId), s.modelId())).isNull();
        assertThat(byModelId(adminGet("/api/v1/reports/model-performance?providerId=" + providerId), s.modelId())).isNull();

        assertThat(ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + s.modelId() + "/unarchive", Map.of("reason", "ok")))
            .get("archivedAt").isNull()).isTrue();
        assertThat(byId(adminGet("/api/v1/models?providerId=" + providerId), s.modelId())).isNotNull();
    }

    // ------------------------------------------------------------------ rename

    @Test
    void renameSetsAndClearsDisplayName() throws Exception {
        Integration in = newIntegration("rename-me");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        UUID providerId = providerId(in);
        String url = "/api/v1/models/" + s.modelId();

        JsonNode view = ok(asAdmin(HttpMethod.PATCH, url, Map.of("displayName", "  Pretty Name ", "reason", "typo")));
        assertThat(view.get("displayName").asText()).isEqualTo("Pretty Name");
        assertThat(view.get("name").asText()).isEqualTo("rename-me");
        assertThat(byModelId(adminGet("/api/v1/reports/model-performance?providerId=" + providerId), s.modelId())
            .get("modelName").asText()).isEqualTo("Pretty Name");
        assertThat(actions("MODEL", s.modelId(), "RENAME")).isEqualTo(1);

        // Same value again: no change, no audit row.
        ok(asAdmin(HttpMethod.PATCH, url, Map.of("displayName", "Pretty Name", "reason", "again")));
        assertThat(actions("MODEL", s.modelId(), "RENAME")).isEqualTo(1);

        // Blank clears it: the name shows again.
        assertThat(ok(asAdmin(HttpMethod.PATCH, url, Map.of("displayName", "  ", "reason", "undo"))).get("displayName").asText())
            .isEqualTo("rename-me");
        assertThat(db.queryForObject("SELECT display_name FROM ai_models WHERE id = ?", String.class, s.modelId())).isNull();
        assertThat(actions("MODEL", s.modelId(), "RENAME")).isEqualTo(2);
    }

    // ------------------------------------------------------------------ merge

    @Test
    void mergeSumsIntoTargetAndUnmergeRestores() throws Exception {
        Integration in = newIntegration("merge-a");
        Seed a = seed(in.provider(), "merge-a", WIN_2_0);
        Seed b = seed(in.provider(), "merge-b", LOSS_0_2);
        UUID providerId = providerId(in);
        String perf = "/api/v1/reports/model-performance?providerId=" + providerId;

        JsonNode merged = ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + a.modelId() + "/merge",
            Map.of("targetModelId", b.modelId(), "reason", "same model")));
        assertThat(merged.get("id").asText()).isEqualTo(a.modelId().toString());
        assertThat(merged.get("mergedIntoId").asText()).isEqualTo(b.modelId().toString());

        JsonNode rows = adminGet(perf);
        assertThat(byModelId(rows, a.modelId())).isNull();
        JsonNode target = byModelId(rows, b.modelId());
        assertThat(target.get("predictions").asInt()).isEqualTo(2);
        assertThat(target.get("wins").asInt()).isEqualTo(2);
        assertThat(target.get("losses").asInt()).isEqualTo(2);
        assertThat(byId(adminGet("/api/v1/models?providerId=" + providerId), a.modelId())).isNull();
        var action = db.queryForMap("SELECT reason, details::text AS details FROM admin_actions WHERE entity_id = ? AND action = 'MERGE'",
            a.modelId());
        assertThat(action.get("reason")).isEqualTo("same model");
        JsonNode details = json.readTree((String) action.get("details"));
        assertThat(details.get("from").isNull()).isTrue();
        assertThat(details.get("to").asText()).isEqualTo(b.modelId().toString());

        // Merging again into the same target is a no-op.
        ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + a.modelId() + "/merge", Map.of("targetModelId", b.modelId(), "reason", "again")));
        assertThat(actions("MODEL", a.modelId(), "MERGE")).isEqualTo(1);

        // Prediction detail shows the effective model: the target and its display name; the key stays the target's raw name.
        ok(asAdmin(HttpMethod.PATCH, "/api/v1/models/" + b.modelId(), Map.of("displayName", "Target Pretty", "reason", "name")));
        JsonNode model = adminGet("/api/v1/predictions/" + a.predictionId()).get("model");
        assertThat(model.get("id").asText()).isEqualTo(b.modelId().toString());
        assertThat(model.get("name").asText()).isEqualTo("Target Pretty");
        assertThat(model.get("key").asText()).isEqualTo("merge-b");

        JsonNode unmerged = ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + a.modelId() + "/unmerge", Map.of("reason", "were different")));
        assertThat(unmerged.get("mergedIntoId").isNull()).isTrue();
        JsonNode after = adminGet(perf);
        assertThat(byModelId(after, a.modelId()).get("predictions").asInt()).isEqualTo(1);
        assertThat(byModelId(after, b.modelId()).get("predictions").asInt()).isEqualTo(1);
        assertThat(actions("MODEL", a.modelId(), "UNMERGE")).isEqualTo(1);

        // Unmerging a model that is not merged changes nothing.
        ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + a.modelId() + "/unmerge", Map.of("reason", "again")));
        assertThat(actions("MODEL", a.modelId(), "UNMERGE")).isEqualTo(1);
    }

    @Test
    void mergeRejectsCrossProviderSelfAndMergedTarget() throws Exception {
        Integration p1 = newIntegration("rej-a");
        Integration p2 = newIntegration("rej-x");
        Seed a = seed(p1.provider(), "rej-a", WIN_2_0);
        Seed b = seed(p1.provider(), "rej-b", WIN_2_0);
        Seed c = seed(p1.provider(), "rej-c", WIN_2_0);
        Seed x = seed(p2.provider(), "rej-x", WIN_2_0);
        String url = "/api/v1/models/" + a.modelId() + "/merge";

        assertCode(asAdmin(HttpMethod.POST, url, Map.of("targetModelId", x.modelId(), "reason", "r")), 409, "MODEL_MERGE_CROSS_PROVIDER");
        assertCode(asAdmin(HttpMethod.POST, url, Map.of("targetModelId", a.modelId(), "reason", "r")), 400, "MODEL_MERGE_SELF");
        assertCode(asAdmin(HttpMethod.POST, url, Map.of("targetModelId", UUID.randomUUID(), "reason", "r")), 404, "MODEL_NOT_FOUND");

        ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + b.modelId() + "/merge", Map.of("targetModelId", c.modelId(), "reason", "r")));
        // b is now merged into c: nothing may merge into b, and b cannot be merged elsewhere without unmerging first.
        assertCode(asAdmin(HttpMethod.POST, url, Map.of("targetModelId", b.modelId(), "reason", "r")), 409, "MODEL_ALREADY_MERGED");
        assertCode(asAdmin(HttpMethod.POST, "/api/v1/models/" + b.modelId() + "/merge",
            Map.of("targetModelId", a.modelId(), "reason", "r")), 409, "MODEL_ALREADY_MERGED");
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, a.modelId())).isNull();
        assertThat(actions("MODEL", a.modelId(), "MERGE")).isZero();
    }

    @Test
    void mergingAModelWithMergedChildrenRepointsTheChildren() throws Exception {
        Integration in = newIntegration("chain-a");
        Seed a = seed(in.provider(), "chain-a", WIN_2_0);
        Seed b = seed(in.provider(), "chain-b", WIN_2_0);
        Seed c = seed(in.provider(), "chain-c", LOSS_0_2);
        UUID providerId = providerId(in);

        ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + a.modelId() + "/merge", Map.of("targetModelId", b.modelId(), "reason", "r1")));
        JsonNode view = ok(asAdmin(HttpMethod.POST, "/api/v1/models/" + b.modelId() + "/merge",
            Map.of("targetModelId", c.modelId(), "reason", "r2")));

        assertThat(view.get("mergedIntoId").asText()).isEqualTo(c.modelId().toString());
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, a.modelId())).isEqualTo(c.modelId());
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, b.modelId())).isEqualTo(c.modelId());
        // One MERGE row per moved model: a (b -> c) and b itself (none -> c), both with the reason of this call.
        var moved = db.queryForMap("SELECT reason, details::text AS details FROM admin_actions WHERE entity_id = ? AND reason = 'r2'",
            a.modelId());
        JsonNode d = json.readTree((String) moved.get("details"));
        assertThat(d.get("from").asText()).isEqualTo(b.modelId().toString());
        assertThat(d.get("to").asText()).isEqualTo(c.modelId().toString());
        assertThat(actions("MODEL", b.modelId(), "MERGE")).isEqualTo(1);
        assertThat(byModelId(adminGet("/api/v1/reports/model-performance?providerId=" + providerId), c.modelId())
            .get("predictions").asInt()).isEqualTo(3);
    }

    // ------------------------------------------------------------------ users

    @Test
    void usersStatusFilter() throws Exception {
        String name = "gone-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode user = adminPost("/api/v1/users", Map.of("username", name, "password", "viewer-password-1", "role", "VIEWER"));
        MvcResult patch = asAdmin(HttpMethod.PATCH, "/api/v1/users/" + user.get("id").asText(), Map.of("status", "DISABLED"));
        ok(patch);

        JsonNode disabled = adminGet("/api/v1/users?status=DISABLED");
        assertThat(disabled).isNotEmpty();
        for (JsonNode u : disabled) assertThat(u.get("status").asText()).isEqualTo("DISABLED");
        assertThat(byId(disabled, UUID.fromString(user.get("id").asText()))).isNotNull();
        JsonNode active = adminGet("/api/v1/users?status=ACTIVE");
        for (JsonNode u : active) assertThat(u.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(byId(active, UUID.fromString(user.get("id").asText()))).isNull();
        assertThat(adminGet("/api/v1/users").size()).isEqualTo(active.size() + disabled.size());

        assertCode(mvc.perform(asAdmin(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/users?status=NOPE")))
            .andReturn(), 400, "INVALID_STATUS");

        // The existing guard still holds: an admin cannot disable themself.
        UUID me = db.queryForObject("SELECT id FROM users WHERE username = ?", UUID.class, ADMIN);
        assertCode(asAdmin(HttpMethod.PATCH, "/api/v1/users/" + me, Map.of("status", "DISABLED")), 400, "SELF_LOCKOUT");
    }
}
