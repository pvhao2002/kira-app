package com.matchmind.it;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** V24: model merge integrity (no chain, same provider, no self merge) and the append-only admin_actions log. */
class ArchiveMergeSchemaIT extends IntegrationTestBase {

    /** Creates a model (and its provider) through the external API, returns the model id. */
    private UUID seedModel(String provider, String modelName) throws Exception {
        external(provider, "predictions", Payloads.livePrediction("e-" + UUID.randomUUID(),
            "m-" + UUID.randomUUID().toString().substring(0, 8), modelName));
        return db.queryForObject("""
            SELECT m.id FROM ai_models m JOIN providers p ON p.id = m.provider_id
            WHERE p.code = ? AND m.name = ?""", UUID.class, provider, modelName);
    }

    private void mergeInto(UUID from, UUID target) {
        db.update("UPDATE ai_models SET merged_into_id = ? WHERE id = ?", target, from);
    }

    @Test
    void mergeChainIsRejectedByDb() throws Exception {
        Integration in = newIntegration("a");
        UUID a = seedModel(in.provider(), "model-a");
        UUID b = seedModel(in.provider(), "model-b");
        UUID c = seedModel(in.provider(), "model-c");

        mergeInto(a, b);
        // B -> C would make A -> B -> C: target of A gains its own target.
        assertThatThrownBy(() -> mergeInto(b, c)).hasMessageContaining("MM_MODEL_MERGE_CHAIN");
        // A -> B exists and B has no target, so merging C into A (a merged row) is a chain too.
        assertThatThrownBy(() -> mergeInto(c, a)).hasMessageContaining("MM_MODEL_MERGE_CHAIN");
        // The legal shape still works: C -> B (B is a plain target).
        mergeInto(c, b);
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, c)).isEqualTo(b);
        // Unmerge is a plain update to NULL and must pass.
        db.update("UPDATE ai_models SET merged_into_id = NULL WHERE id = ?", c);
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, c)).isNull();
    }

    @Test
    void concurrentMergesCannotFormAChain() throws Exception {
        Integration in = newIntegration("race");
        UUID a = seedModel(in.provider(), "race-a");
        UUID b = seedModel(in.provider(), "race-b");
        UUID c = seedModel(in.provider(), "race-c");
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try (Connection c1 = db.getDataSource().getConnection(); Connection c2 = db.getDataSource().getConnection()) {
            c1.setAutoCommit(false);
            c2.setAutoCommit(false);
            try (var s1 = c1.prepareStatement("UPDATE ai_models SET merged_into_id = ? WHERE id = ?")) {
                s1.setObject(1, b);
                s1.setObject(2, a);
                s1.executeUpdate(); // A -> B, uncommitted
            }
            Future<?> second = pool.submit(() -> {
                try (var s2 = c2.prepareStatement("UPDATE ai_models SET merged_into_id = ? WHERE id = ?")) {
                    s2.setObject(1, c);
                    s2.setObject(2, b);
                    s2.executeUpdate(); // B -> C must wait for the first merge, then see it
                    return null;
                } catch (java.sql.SQLException e) {
                    throw new IllegalStateException(e);
                }
            });
            assertThatThrownBy(() -> second.get(1, TimeUnit.SECONDS)).isInstanceOf(TimeoutException.class);
            c1.commit();
            assertThatThrownBy(() -> second.get(10, TimeUnit.SECONDS))
                .hasStackTraceContaining("MM_MODEL_MERGE_CHAIN");
            c2.rollback();
        } finally {
            pool.shutdownNow();
        }
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, a)).isEqualTo(b);
        assertThat(db.queryForObject("SELECT merged_into_id FROM ai_models WHERE id = ?", UUID.class, b)).isNull();
    }

    @Test
    void crossProviderMergeIsRejectedByDb() throws Exception {
        UUID a = seedModel(newIntegration("x").provider(), "model-x");
        UUID b = seedModel(newIntegration("y").provider(), "model-y");
        assertThatThrownBy(() -> mergeInto(a, b)).hasMessageContaining("fk_ai_models_merged_into");
    }

    @Test
    void selfMergeIsRejectedByDb() throws Exception {
        UUID a = seedModel(newIntegration("s").provider(), "model-s");
        assertThatThrownBy(() -> mergeInto(a, a)).hasMessageContaining("ck_ai_models_not_self_merged");
    }

    @Test
    void adminActionsAreAppendOnly() {
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO admin_actions (entity, entity_id, action, reason) VALUES ('MODEL', ?, 'RENAME', 'typo')", id);
        assertThatThrownBy(() -> db.update(
            "INSERT INTO admin_actions (entity, entity_id, action, reason) VALUES ('MODEL', ?, 'RENAME', '  ')", id))
            .hasMessageContaining("ck_admin_actions_reason_not_blank");
        assertThatThrownBy(() -> db.update("UPDATE admin_actions SET reason = 'x' WHERE entity_id = ?", id))
            .hasMessageContaining("MM_IMMUTABLE");
        assertThatThrownBy(() -> db.update("DELETE FROM admin_actions WHERE entity_id = ?", id))
            .hasMessageContaining("MM_IMMUTABLE");
        assertThatThrownBy(() -> db.execute("TRUNCATE admin_actions")).hasMessageContaining("MM_IMMUTABLE");
    }
}
