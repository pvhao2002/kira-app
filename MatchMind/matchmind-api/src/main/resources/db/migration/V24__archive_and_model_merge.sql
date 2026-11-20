-- Archive (hide bad data), model rename (display_name) and same-provider model merge (merged_into_id).
-- Nothing is deleted: archived rows and merged models keep their predictions; read paths filter in later code.

ALTER TABLE providers ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE ai_models ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE matches   ADD COLUMN archived_at TIMESTAMPTZ;
CREATE INDEX ix_providers_active ON providers (id) WHERE archived_at IS NULL;
CREATE INDEX ix_ai_models_active ON ai_models (id) WHERE archived_at IS NULL;
CREATE INDEX ix_matches_active   ON matches (id)   WHERE archived_at IS NULL;

-- display_name overrides the provider-supplied name in the UI only; the identity (name, version) never changes.
ALTER TABLE ai_models ADD COLUMN display_name VARCHAR(128);
-- A merged model points at the surviving model of the SAME provider (composite FK on the existing (id, provider_id) key).
ALTER TABLE ai_models ADD COLUMN merged_into_id UUID;
ALTER TABLE ai_models ADD CONSTRAINT fk_ai_models_merged_into
    FOREIGN KEY (merged_into_id, provider_id) REFERENCES ai_models (id, provider_id);
ALTER TABLE ai_models ADD CONSTRAINT ck_ai_models_not_self_merged CHECK (merged_into_id <> id);
CREATE INDEX ix_ai_models_merged_into ON ai_models (merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Merges are one level deep: a merge target never has a target, and a row that others merge into cannot be merged away.
-- Re-pointing A -> B to A -> C when B is merged into C is application logic; this only rejects the 2-level chain.
-- The checks only read, so two concurrent merges (A->B and B->C) could both pass under READ COMMITTED. Merges are
-- same-provider only (composite FK), so a per-provider transaction lock serialises them; the SELECTs below run after
-- the lock is granted and therefore see the rival's committed row.
CREATE FUNCTION mm_ai_models_no_chain() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF NEW.merged_into_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('mm_model_merge'), hashtext(NEW.provider_id::text));
    END IF;
    IF NEW.merged_into_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM ai_models t WHERE t.id = NEW.merged_into_id AND t.merged_into_id IS NOT NULL)
        OR EXISTS (SELECT 1 FROM ai_models c WHERE c.merged_into_id = NEW.id)
    ) THEN
        RAISE EXCEPTION 'MM_MODEL_MERGE_CHAIN: %', NEW.id USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_ai_models_no_chain BEFORE INSERT OR UPDATE OF merged_into_id ON ai_models
    FOR EACH ROW EXECUTE FUNCTION mm_ai_models_no_chain();

-- Append-only audit of admin hygiene actions (V23 rule: immutable triggers + no truncate).
CREATE TABLE admin_actions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity     VARCHAR(16) NOT NULL CHECK (entity IN ('PROVIDER', 'MODEL', 'MATCH')),
    entity_id  UUID        NOT NULL,
    action     VARCHAR(16) NOT NULL CHECK (action IN ('ARCHIVE', 'UNARCHIVE', 'RENAME', 'MERGE', 'UNMERGE')),
    reason     TEXT        NOT NULL CONSTRAINT ck_admin_actions_reason_not_blank CHECK (btrim(reason) <> ''),
    actor      UUID REFERENCES users (id),
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    details    JSONB
);
CREATE INDEX ix_admin_actions_entity ON admin_actions (entity, entity_id, at DESC);

CREATE TRIGGER trg_admin_actions_immutable BEFORE UPDATE OR DELETE ON admin_actions
    FOR EACH ROW EXECUTE FUNCTION mm_forbid_change();
CREATE TRIGGER trg_admin_actions_no_truncate BEFORE TRUNCATE ON admin_actions
    FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change();
