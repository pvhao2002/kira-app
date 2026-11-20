package com.matchmind.it;

import org.junit.jupiter.api.Test;

import java.util.UUID;

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
        assertThatThrownBy(() -> db.update("UPDATE admin_actions SET reason = 'x' WHERE entity_id = ?", id))
            .hasMessageContaining("MM_IMMUTABLE");
        assertThatThrownBy(() -> db.update("DELETE FROM admin_actions WHERE entity_id = ?", id))
            .hasMessageContaining("MM_IMMUTABLE");
        assertThatThrownBy(() -> db.execute("TRUNCATE admin_actions")).hasMessageContaining("MM_IMMUTABLE");
    }
}
