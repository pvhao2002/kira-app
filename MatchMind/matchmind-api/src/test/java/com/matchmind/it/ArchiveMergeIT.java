package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Archive hides bad data from every aggregate, list and dropdown; a same-provider merge rolls the merged model's stats
 * into its target. Archive and merge are applied with raw SQL here: the admin API is a later task.
 * Every livePrediction settles to wins/losses by final score: 3-0 gives 2 wins 0 losses, 1-0 gives 0 wins 2 losses,
 * 2-1 gives 1 win 1 loss.
 */
class ArchiveMergeIT extends IntegrationTestBase {
    private static final String WIN_2_0 = "{\"home\":3,\"away\":0}";
    private static final String LOSS_0_2 = "{\"home\":1,\"away\":0}";

    private record Seed(UUID modelId, UUID matchId) {
    }

    /** One settled prediction by {@code model} (created on first use) on a fresh match of {@code provider}. */
    private Seed seed(String provider, String model, String finalScore) throws Exception {
        String match = "am-" + UUID.randomUUID().toString().substring(0, 8);
        // Own teams per seed: same-provider matches of one game share a fixture, and the count policy (UX-046) then
        // counts one prediction per effective model there. Seeds stand for different games.
        external(provider, "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(), match, model, "Home " + match,
            "Away " + match, "Premier League", java.time.Instant.parse("2026-11-10T19:45:00Z")));
        external(provider, "matches/results", Payloads.result(match, "FINISHED", finalScore, null, "2026-11-10T21:40:00Z"));
        return new Seed(
            db.queryForObject("""
                SELECT m.id FROM ai_models m JOIN providers p ON p.id = m.provider_id
                WHERE p.code = ? AND m.name = ?""", UUID.class, provider, model),
            db.queryForObject("""
                SELECT m.id FROM matches m JOIN providers p ON p.id = m.provider_id
                WHERE p.code = ? AND m.external_match_id = ?""", UUID.class, provider, match));
    }

    private void archive(String table, UUID id) {
        db.update("UPDATE " + table + " SET archived_at = now() WHERE id = ?", id);
    }

    private void mergeInto(UUID from, UUID target) {
        db.update("UPDATE ai_models SET merged_into_id = ? WHERE id = ?", target, from);
    }

    private static JsonNode byId(JsonNode rows, String field, UUID id) {
        for (JsonNode n : rows) if (id.toString().equals(n.get(field).asText())) return n;
        return null;
    }

    private JsonNode performance(String query) throws Exception {
        return adminGet("/api/v1/reports/model-performance" + query);
    }

    private long totalPredictions(String query) throws Exception {
        return adminGet("/api/v1/dashboard" + query).get("totals").get("totalPredictions").asLong();
    }

    private long totalModels(String query) throws Exception {
        return adminGet("/api/v1/dashboard" + query).get("totals").get("totalModels").asLong();
    }

    @Test
    void archivedProviderHiddenFromReportsAndDropdowns() throws Exception {
        Integration in = newIntegration("arch-prov");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        UUID providerId = providerId(in);
        // Other ITs share the database (and leave archived rows behind), so count both views before archiving.
        long before = totalPredictions("");
        long beforeAll = totalPredictions("?includeArchived=true");

        archive("providers", providerId);

        // Aggregates, lists and dropdowns drop the provider, its model and its match without any write to the children.
        assertThat(totalPredictions("")).isEqualTo(before - 1);
        assertThat(byId(performance(""), "modelId", s.modelId())).isNull();
        assertThat(byId(adminGet("/api/v1/models"), "id", s.modelId())).isNull();
        assertThat(byId(adminGet("/api/v1/providers"), "id", providerId)).isNull();
        String externalMatchId = db.queryForObject("SELECT external_match_id FROM matches WHERE id = ?", String.class, s.matchId());
        assertThat(adminGet("/api/v1/matches?search=" + externalMatchId).get("meta").get("totalElements").asInt()).isZero();
        assertThat(adminGet("/api/v1/predictions?modelId=" + s.modelId()).get("meta").get("totalElements").asInt()).isZero();

        // includeArchived brings everything back.
        assertThat(totalPredictions("?includeArchived=true")).isEqualTo(beforeAll);
        assertThat(byId(performance("?includeArchived=true"), "modelId", s.modelId())).isNotNull();
        assertThat(byId(adminGet("/api/v1/models?includeArchived=true"), "id", s.modelId())).isNotNull();
        assertThat(byId(adminGet("/api/v1/providers?includeArchived=true"), "id", providerId)).isNotNull();

        // An explicit providerId unhides that provider (and its models) only.
        JsonNode scoped = performance("?providerId=" + providerId);
        assertThat(byId(scoped, "modelId", s.modelId()).get("predictions").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches?providerId=" + providerId).get("meta").get("totalElements").asInt()).isEqualTo(1);
    }

    @Test
    void explicitModelIdShowsArchived() throws Exception {
        Integration in = newIntegration("arch-model");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        UUID providerId = providerId(in);
        archive("ai_models", s.modelId());

        assertThat(byId(performance("?providerId=" + providerId), "modelId", s.modelId())).isNull();
        assertThat(byId(adminGet("/api/v1/models?providerId=" + providerId), "id", s.modelId())).isNull();

        JsonNode row = byId(performance("?modelId=" + s.modelId()), "modelId", s.modelId());
        assertThat(row.get("predictions").asInt()).isEqualTo(1);
        assertThat(row.get("wins").asInt()).isEqualTo(2);
        assertThat(adminGet("/api/v1/predictions?modelId=" + s.modelId()).get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(byId(performance("?providerId=" + providerId + "&includeArchived=true"), "modelId", s.modelId())).isNotNull();
        assertThat(byId(adminGet("/api/v1/models?providerId=" + providerId + "&includeArchived=true"), "id", s.modelId())).isNotNull();
    }

    @Test
    void archivedMatchExcludedFromAggregatesEvenWithModelId() throws Exception {
        Integration in = newIntegration("arch-match");
        Seed good = seed(in.provider(), in.modelName(), WIN_2_0);
        Seed bad = seed(in.provider(), in.modelName(), LOSS_0_2);
        archive("matches", bad.matchId());

        // Bad data stays out of the model's numbers even when the model is named explicitly.
        JsonNode row = byId(performance("?modelId=" + good.modelId()), "modelId", good.modelId());
        assertThat(row.get("predictions").asInt()).isEqualTo(1);
        assertThat(row.get("wins").asInt()).isEqualTo(2);
        assertThat(row.get("losses").asInt()).isZero();
        assertThat(adminGet("/api/v1/predictions?modelId=" + good.modelId()).get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches?providerId=" + providerId(in)).get("meta").get("totalElements").asInt()).isEqualTo(1);

        // includeArchived or an explicit matchId brings it back.
        JsonNode all = byId(performance("?modelId=" + good.modelId() + "&includeArchived=true"), "modelId", good.modelId());
        assertThat(all.get("predictions").asInt()).isEqualTo(2);
        assertThat(all.get("losses").asInt()).isEqualTo(2);
        assertThat(adminGet("/api/v1/predictions?matchId=" + bad.matchId()).get("meta").get("totalElements").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/matches?providerId=" + providerId(in) + "&includeArchived=true")
            .get("meta").get("totalElements").asInt()).isEqualTo(2);
    }

    @Test
    void archivedMatchLeagueLeavesDropdown() throws Exception {
        Integration in = newIntegration("arch-league");
        Seed s = seed(in.provider(), in.modelName(), WIN_2_0);
        String league = "Zeta " + UUID.randomUUID();
        db.update("UPDATE matches SET league = ? WHERE id = ?", league, s.matchId());
        archive("matches", s.matchId());

        // The ingest above evicted the cache and nothing has read the dropdown since, so these are fresh queries.
        assertThat(adminGet("/api/v1/matches/leagues").toString()).doesNotContain(league);
        assertThat(adminGet("/api/v1/matches/leagues?includeArchived=true").toString()).contains(league);
    }

    @Test
    void mergeSumsWinRate() throws Exception {
        Integration in = newIntegration("merge-a");
        Seed a = seed(in.provider(), "merge-a", WIN_2_0);
        Seed b = seed(in.provider(), "merge-b", LOSS_0_2);
        UUID providerId = providerId(in);
        String q = "?providerId=" + providerId;

        assertThat(performance(q)).hasSize(2);
        assertThat(byId(performance(q), "modelId", a.modelId()).get("winRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(byId(performance(q), "modelId", b.modelId()).get("winRate").decimalValue()).isEqualByComparingTo("0");

        mergeInto(b.modelId(), a.modelId());

        JsonNode perf = performance(q);
        assertThat(perf).hasSize(1);
        JsonNode row = perf.get(0);
        assertThat(row.get("modelId").asText()).isEqualTo(a.modelId().toString());
        assertThat(row.get("predictions").asInt()).isEqualTo(2);
        assertThat(row.get("wins").asInt()).isEqualTo(2);
        assertThat(row.get("losses").asInt()).isEqualTo(2);
        assertThat(row.get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(row.get("correctScoreEvaluated").asInt()).isEqualTo(2);

        // Model list and dropdown: only the target, with the combined stats; the merged model is not deleted.
        JsonNode models = adminGet("/api/v1/models" + q);
        assertThat(models).hasSize(1);
        assertThat(models.get(0).get("id").asText()).isEqualTo(a.modelId().toString());
        assertThat(models.get(0).get("totalPredictions").asInt()).isEqualTo(2);
        assertThat(models.get(0).get("wins").asInt()).isEqualTo(2);
        assertThat(models.get(0).get("losses").asInt()).isEqualTo(2);
        assertThat(models.get(0).get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(adminGet("/api/v1/models" + q + "&includeArchived=true")).hasSize(2);

        // Every report agrees: breakdown by model, dashboard, market, prediction list and history.
        JsonNode byModel = adminGet("/api/v1/reports/breakdown" + q + "&by=model");
        assertThat(byModel).hasSize(1);
        assertThat(byModel.get(0).get("key").asText()).startsWith("merge-a");
        assertThat(byModel.get(0).get("picks").asInt()).isEqualTo(4);
        JsonNode dash = adminGet("/api/v1/dashboard" + q);
        assertThat(dash.get("totals").get("activeModels").asInt()).isEqualTo(1);
        assertThat(dash.get("totals").get("winRate").decimalValue()).isEqualByComparingTo("0.5");
        assertThat(dash.get("predictionsByModel")).hasSize(1);
        assertThat(dash.get("predictionsByModel").get(0).get("predictions").asInt()).isEqualTo(2);
        JsonNode ah = null;
        for (JsonNode m : adminGet("/api/v1/reports/market-performance" + q)) if ("AH".equals(m.get("market").asText())) ah = m;
        assertThat(ah.get("picks").asInt()).isEqualTo(2);
        assertThat(ah.get("wins").asInt()).isEqualTo(1);
        assertThat(ah.get("losses").asInt()).isEqualTo(1);
        JsonNode list = adminGet("/api/v1/predictions" + q + "&size=10");
        assertThat(list.get("meta").get("totalElements").asInt()).isEqualTo(2);
        for (JsonNode p : list.get("data")) {
            assertThat(p.get("modelId").asText()).isEqualTo(a.modelId().toString());
            assertThat(p.get("modelKey").asText()).isEqualTo("merge-a");
        }
        JsonNode history = adminGet("/api/v1/reports/prediction-history" + q + "&size=10");
        assertThat(history.get("meta").get("totalElements").asInt()).isEqualTo(4);
        for (JsonNode p : history.get("data")) assertThat(p.get("modelId").asText()).isEqualTo(a.modelId().toString());

        // modelId = the target covers the merged model's predictions too; the merged model itself stays addressable.
        assertThat(adminGet("/api/v1/predictions?modelId=" + a.modelId()).get("meta").get("totalElements").asInt()).isEqualTo(2);
        assertThat(adminGet("/api/v1/predictions?modelId=" + b.modelId()).get("meta").get("totalElements").asInt()).isEqualTo(1);

        // Two models on one match count as one model once merged.
        String match = "am-" + UUID.randomUUID().toString().substring(0, 8);
        // Other teams than the seeds: same-provider rows of one game would share one fixture (one comparison row).
        java.time.Instant kickOff = java.time.Instant.parse("2026-11-10T19:45:00Z");
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(), match, "merge-a", "Everton", "Fulham", "Premier League", kickOff));
        external(in.provider(), "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(), match, "merge-b", "Everton", "Fulham", "Premier League", kickOff));
        JsonNode comparison = adminGet("/api/v1/reports/model-comparison" + q + "&minModels=2");
        assertThat(comparison.get("data")).isEmpty();
        JsonNode single = adminGet("/api/v1/reports/model-comparison" + q + "&minModels=1&size=50");
        JsonNode both = null;
        for (JsonNode m : single.get("data")) if (m.get("models").size() == 1 && m.get("models").get(0).get("predictionCount").asInt() == 2) both = m;
        assertThat(both).as("match with two predictions rolled into one model").isNotNull();
    }

    @Test
    void namedTargetKeepsArchivedMergedChildOut() throws Exception {
        Integration in = newIntegration("target-a");
        Seed a = seed(in.provider(), "target-a", WIN_2_0);
        Seed b = seed(in.provider(), "target-b", LOSS_0_2);
        mergeInto(b.modelId(), a.modelId());
        archive("ai_models", b.modelId());
        String q = "?providerId=" + providerId(in);

        // Archived child B is bad data: A's numbers must not change when A is named explicitly.
        JsonNode viaProvider = byId(performance(q), "modelId", a.modelId());
        JsonNode viaModel = byId(performance("?modelId=" + a.modelId()), "modelId", a.modelId());
        assertThat(viaProvider.get("predictions").asInt()).isEqualTo(1);
        assertThat(viaModel.get("predictions").asInt()).isEqualTo(1);
        assertThat(viaModel.get("wins").asInt()).isEqualTo(viaProvider.get("wins").asInt()).isEqualTo(2);
        assertThat(viaModel.get("losses").asInt()).isEqualTo(viaProvider.get("losses").asInt()).isZero();
        assertThat(adminGet("/api/v1/predictions?modelId=" + a.modelId()).get("meta").get("totalElements").asInt()).isEqualTo(1);
        // /models agrees with the reports, and includeArchived brings the child's predictions back everywhere.
        JsonNode model = byId(adminGet("/api/v1/models" + q), "id", a.modelId());
        assertThat(model.get("totalPredictions").asInt()).isEqualTo(1);
        assertThat(model.get("losses").asInt()).isZero();
        JsonNode all = byId(adminGet("/api/v1/models" + q + "&includeArchived=true"), "id", a.modelId());
        assertThat(all.get("totalPredictions").asInt()).isEqualTo(2);
        assertThat(byId(performance("?modelId=" + a.modelId() + "&includeArchived=true"), "modelId", a.modelId())
            .get("predictions").asInt()).isEqualTo(2);
    }

    @Test
    void modelsListFollowsReportRulesForArchivedMatchesAndProviders() throws Exception {
        Integration in = newIntegration("rules-a");
        Seed good = seed(in.provider(), "rules-a", WIN_2_0);
        Seed bad = seed(in.provider(), "rules-a", LOSS_0_2);
        archive("matches", bad.matchId());
        String q = "?providerId=" + providerId(in);

        assertThat(adminGet("/api/v1/models" + q).get(0).get("totalPredictions").asInt()).isEqualTo(1);
        assertThat(adminGet("/api/v1/models" + q + "&includeArchived=true").get(0).get("totalPredictions").asInt()).isEqualTo(2);

        // Naming an archived provider unhides it (like the reports); its models are then listed.
        archive("providers", providerId(in));
        assertThat(adminGet("/api/v1/models" + q)).hasSize(1);
        assertThat(byId(adminGet("/api/v1/models"), "id", good.modelId())).isNull();
    }

    @Test
    void unmergeRestores() throws Exception {
        Integration in = newIntegration("unmerge-a");
        Seed a = seed(in.provider(), "unmerge-a", WIN_2_0);
        Seed b = seed(in.provider(), "unmerge-b", LOSS_0_2);
        String q = "?providerId=" + providerId(in);

        mergeInto(b.modelId(), a.modelId());
        assertThat(performance(q)).hasSize(1);
        db.update("UPDATE ai_models SET merged_into_id = NULL WHERE id = ?", b.modelId());

        JsonNode perf = performance(q);
        assertThat(perf).hasSize(2);
        assertThat(byId(perf, "modelId", a.modelId()).get("predictions").asInt()).isEqualTo(1);
        assertThat(byId(perf, "modelId", a.modelId()).get("winRate").decimalValue()).isEqualByComparingTo("1");
        assertThat(byId(perf, "modelId", b.modelId()).get("predictions").asInt()).isEqualTo(1);
        assertThat(byId(perf, "modelId", b.modelId()).get("winRate").decimalValue()).isEqualByComparingTo("0");
        JsonNode models = adminGet("/api/v1/models" + q);
        assertThat(models).hasSize(2);
        assertThat(byId(models, "id", b.modelId()).get("totalPredictions").asInt()).isEqualTo(1);
    }

    /** Ingests one prediction of {@code model} on a fresh match and returns the model id it landed on. */
    private UUID ingestLandsOn(String provider, String model) throws Exception {
        String eventId = "e-" + UUID.randomUUID();
        var result = external(provider, "predictions",
            Payloads.livePrediction(eventId, "am-" + UUID.randomUUID().toString().substring(0, 8), model));
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(201);
        return db.queryForObject("SELECT ai_model_id FROM predictions WHERE external_event_id = ?", UUID.class, eventId);
    }

    @Test
    void ingestOfMergedSourceLandsOnTarget() throws Exception {
        Integration in = newIntegration("Ingest Target");
        Seed target = seed(in.provider(), "Ingest Target", WIN_2_0);
        Seed source = seed(in.provider(), "Ingest Source", LOSS_0_2);
        UUID providerId = providerId(in);
        mergeInto(source.modelId(), target.modelId());
        int modelRows = db.queryForObject("SELECT count(*) FROM ai_models WHERE provider_id = ?", Integer.class, providerId);

        // The old spelling, and its case/spacing variants (same V14 identity), land on the target; no model row is added.
        UUID exact = ingestLandsOn(in.provider(), "Ingest Source");
        assertThat(exact).isEqualTo(target.modelId());
        assertThat(ingestLandsOn(in.provider(), "  ingest   SOURCE ")).isEqualTo(target.modelId());
        assertThat(db.queryForObject("SELECT count(*) FROM ai_models WHERE provider_id = ?", Integer.class, providerId))
            .isEqualTo(modelRows);
        // The merged row itself is untouched, and its own old predictions stay on it.
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, source.modelId()))
            .isEqualTo(target.modelId());
        assertThat(db.queryForObject("SELECT count(*) FROM predictions WHERE ai_model_id = ?", Integer.class, source.modelId()))
            .isEqualTo(1);

        // Unmerge: new ingests of the old name go back to the source; the post-merge predictions are immutable snapshots
        // and stay on the target.
        db.update("UPDATE ai_models SET merged_into_id = NULL WHERE id = ?", source.modelId());
        assertThat(ingestLandsOn(in.provider(), "Ingest Source")).isEqualTo(source.modelId());
        assertThat(db.queryForObject("SELECT count(*) FROM predictions WHERE ai_model_id = ?", Integer.class, target.modelId()))
            .isEqualTo(3);
        assertThat(db.queryForObject("SELECT count(*) FROM ai_models WHERE provider_id = ?", Integer.class, providerId))
            .isEqualTo(modelRows);
    }

    @Test
    void archivedMergedSourceStillAcceptsIngestOnTarget() throws Exception {
        Integration in = newIntegration("Arch Target");
        Seed target = seed(in.provider(), "Arch Target", WIN_2_0);
        Seed source = seed(in.provider(), "Arch Source", LOSS_0_2);
        mergeInto(source.modelId(), target.modelId());
        archive("ai_models", source.modelId());

        // Owner decision 2: archived rows still accept callbacks; ingest neither blocks nor unarchives.
        assertThat(ingestLandsOn(in.provider(), "Arch Source")).isEqualTo(target.modelId());
        assertThat(db.queryForObject("SELECT archived_at IS NOT NULL FROM ai_models WHERE id = ?", Boolean.class, source.modelId()))
            .isTrue();
    }

    @Test
    void displayNameReplacesNameButKeyStays() throws Exception {
        Integration in = newIntegration("raw-key");
        Seed s = seed(in.provider(), "raw-key", WIN_2_0);
        db.update("UPDATE ai_models SET display_name = 'Friendly name' WHERE id = ?", s.modelId());
        String q = "?providerId=" + providerId(in);

        JsonNode row = performance(q).get(0);
        assertThat(row.get("modelName").asText()).isEqualTo("Friendly name");
        assertThat(row.get("modelKey").asText()).isEqualTo("raw-key");
        JsonNode p = adminGet("/api/v1/predictions" + q).get("data").get(0);
        assertThat(p.get("modelName").asText()).isEqualTo("Friendly name");
        assertThat(p.get("modelKey").asText()).isEqualTo("raw-key");
        assertThat(adminGet("/api/v1/models" + q).get(0).get("displayName").asText()).isEqualTo("Friendly name");
        assertThat(adminGet("/api/v1/models" + q).get(0).get("name").asText()).isEqualTo("raw-key");
    }

    @Test
    void dashboardTotalModelsExcludesArchivedAndMerged() throws Exception {
        Integration in = newIntegration("tm-a");
        Seed a = seed(in.provider(), "tm-a", WIN_2_0);
        Seed b = seed(in.provider(), "tm-b", WIN_2_0);
        Seed c = seed(in.provider(), "tm-c", WIN_2_0);
        // Other ITs share the database, so compare with the count taken after seeding.
        long shown = totalModels("");
        long all = totalModels("?includeArchived=true");

        mergeInto(b.modelId(), a.modelId());
        assertThat(totalModels("")).isEqualTo(shown - 1);

        archive("ai_models", c.modelId());
        assertThat(totalModels("")).isEqualTo(shown - 2);

        archive("providers", providerId(in)); // hides the one model left under the provider (a)
        assertThat(totalModels("")).isEqualTo(shown - 3);
        assertThat(totalModels("?includeArchived=true")).isEqualTo(all);
    }
}
