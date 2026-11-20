package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** UX-088: snapshots are immutable and settlement history append-only in the DB itself, even for a superuser. */
class DbIntegrityIT extends IntegrationTestBase {

    private record Seeded(UUID predictionId, UUID matchId, UUID pickId) {
    }

    /** A live prediction (odds, stats, simulation, picks, correct score) on a FINISHED match, so every table has rows. */
    private Seeded seed() throws Exception {
        Integration in = newIntegration("integrity");
        String match = "m-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode created = read(external(in.provider(), "predictions",
            Payloads.livePrediction("e-" + UUID.randomUUID(), match, in.modelName())));
        external(in.provider(), "matches/results",
            Payloads.result(match, "FINISHED", "{\"home\":2,\"away\":1}", null, "2026-11-10T21:40:00Z"));
        return new Seeded(UUID.fromString(created.get("predictionId").asText()),
            db.queryForObject("SELECT id FROM matches WHERE external_match_id = ?", UUID.class, match),
            UUID.fromString(created.get("picks").get(0).get("pickId").asText()));
    }

    private UUID currentResultId(UUID pickId) {
        return db.queryForObject("SELECT id FROM prediction_pick_results WHERE pick_id = ? AND is_current", UUID.class, pickId);
    }

    private static void rejected(Runnable write) {
        assertThatThrownBy(write::run).hasMessageContaining("MM_IMMUTABLE");
    }

    @Test
    void updatePredictionIsRejected() throws Exception {
        Seeded s = seed();
        rejected(() -> db.update("UPDATE predictions SET predicted_at = now() WHERE id = ?", s.predictionId()));
    }

    @Test
    void deleteFromEachSnapshotTableIsRejected() throws Exception {
        Seeded s = seed();
        for (String table : List.of("prediction_odds", "prediction_stats", "prediction_simulations", "prediction_picks",
            "prediction_correct_scores")) {
            assertThat(db.queryForObject("SELECT count(*) FROM " + table + " WHERE prediction_id = ?", Integer.class,
                s.predictionId())).as(table).isPositive();
            rejected(() -> db.update("DELETE FROM " + table + " WHERE prediction_id = ?", s.predictionId()));
        }
        rejected(() -> db.update("DELETE FROM predictions WHERE id = ?", s.predictionId()));
        rejected(() -> db.update("DELETE FROM match_result_history WHERE match_id = ?", s.matchId()));
        rejected(() -> db.update("UPDATE match_result_history SET change_source = 'ADMIN' WHERE match_id = ?", s.matchId()));
        rejected(() -> db.update("DELETE FROM prediction_pick_results WHERE pick_id = ?", s.pickId()));
    }

    @Test
    void truncateIsRejected() throws Exception {
        seed();
        // Leaf tables only: a table other tables reference fails TRUNCATE on the foreign key before any trigger runs.
        for (String table : List.of("prediction_correct_scores", "match_result_history", "prediction_pick_results")) {
            rejected(() -> db.execute("TRUNCATE " + table));
        }
    }

    @Test
    void pickResultResultColumnIsFrozen() throws Exception {
        Seeded s = seed();
        rejected(() -> db.update("UPDATE prediction_pick_results SET result = 'WIN' WHERE id = ?", currentResultId(s.pickId())));
    }

    @Test
    void pickResultCannotBeRevived() throws Exception {
        Seeded s = seed();
        UUID old = currentResultId(s.pickId());
        adminPost("/api/v1/settlements/picks/" + s.pickId() + "/override", Map.of("result", "VOID", "reason", "test"));
        rejected(() -> db.update("UPDATE prediction_pick_results SET is_current = true, superseded_at = NULL WHERE id = ?", old));
    }

    @Test
    void pickResultSupersededByCannotChangeTwice() throws Exception {
        Seeded s = seed();
        UUID old = currentResultId(s.pickId());
        adminPost("/api/v1/settlements/picks/" + s.pickId() + "/override", Map.of("result", "VOID", "reason", "test"));
        rejected(() -> db.update("UPDATE prediction_pick_results SET superseded_by = id WHERE id = ?", old));
    }

    @Test
    void recalculateAndOverrideStillSupersede() throws Exception {
        Seeded s = seed();
        adminPost("/api/v1/settlements/picks/" + s.pickId() + "/override", Map.of("result", "VOID", "reason", "bookmaker void"));
        adminPost("/api/v1/settlements/picks/" + s.pickId() + "/recalculate", Map.of("reason", "re-check"));
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ?", Integer.class, s.pickId()))
            .isEqualTo(3);
        assertThat(db.queryForObject("SELECT count(*) FROM prediction_pick_results WHERE pick_id = ? AND is_current",
            Integer.class, s.pickId())).isEqualTo(1);
        assertThat(db.queryForObject("""
            SELECT count(*) FROM prediction_pick_results
            WHERE pick_id = ? AND NOT is_current AND superseded_at IS NOT NULL AND superseded_by IS NOT NULL""",
            Integer.class, s.pickId())).isEqualTo(2);
    }

    @Test
    void triggersExist() {
        assertThat(db.queryForObject(
            "SELECT count(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_name LIKE 'trg\\_%\\_immutable'",
            Integer.class)).isGreaterThanOrEqualTo(7);
    }
}
