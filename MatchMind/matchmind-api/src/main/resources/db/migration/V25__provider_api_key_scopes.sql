-- Per-provider API keys (UX-027) and provider disable (UX-061). provider_api_keys and providers.status exist since V1.

-- What a key may call. New keys get PREDICTIONS + SETTLE_REQUEST; an admin grants RESULTS to a trusted feeder only.
ALTER TABLE provider_api_keys ADD COLUMN scopes VARCHAR(16)[] NOT NULL DEFAULT '{PREDICTIONS,SETTLE_REQUEST}'
    CONSTRAINT ck_provider_api_keys_scopes
        CHECK (scopes <@ ARRAY['PREDICTIONS', 'SETTLE_REQUEST', 'RESULTS']::varchar[] AND cardinality(scopes) > 0);
CREATE INDEX ix_provider_api_keys_active ON provider_api_keys (provider_id) WHERE status = 'ACTIVE';
-- Target of the composite FK below: an audit row's key must belong to the audit row's provider.
ALTER TABLE provider_api_keys ADD CONSTRAINT ux_provider_api_keys_id_provider UNIQUE (id, provider_id);
ALTER TABLE external_api_requests ADD CONSTRAINT fk_external_api_requests_key_provider
    FOREIGN KEY (api_key_id, provider_id) REFERENCES provider_api_keys (id, provider_id);

-- A key never changes identity or owner, is never deleted, and a revoked key stays revoked. Only status (ACTIVE ->
-- REVOKED with revoked_at), label, scopes and last_used_at move.
CREATE FUNCTION mm_provider_api_keys_guard() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF TG_OP = 'DELETE'
        OR NEW.key_id IS DISTINCT FROM OLD.key_id
        OR NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
        OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR (OLD.status = 'REVOKED' AND (NEW.status <> 'REVOKED' OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)) THEN
        RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_provider_api_keys_guard BEFORE UPDATE OR DELETE ON provider_api_keys
    FOR EACH ROW EXECUTE FUNCTION mm_provider_api_keys_guard();
CREATE TRIGGER trg_provider_api_keys_no_truncate BEFORE TRUNCATE ON provider_api_keys
    FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change();

-- Disable: every row is ACTIVE today, so the backfill is a no-op.
ALTER TABLE providers ADD COLUMN disabled_at TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN disabled_reason TEXT;
ALTER TABLE providers ADD CONSTRAINT ck_providers_disabled_at CHECK ((status = 'DISABLED') = (disabled_at IS NOT NULL));

-- Calls authenticated with the shared EXTERNAL_API_KEY, so the cut-over can be watched in API Logs.
ALTER TABLE external_api_requests ADD COLUMN legacy_key BOOLEAN NOT NULL DEFAULT false;

-- Admin log: provider disable/enable and key revoke/scope changes (each with a reason).
ALTER TABLE admin_actions DROP CONSTRAINT admin_actions_action_check;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_action_check CHECK (action IN
    ('ARCHIVE', 'UNARCHIVE', 'RENAME', 'MERGE', 'UNMERGE', 'DISABLE', 'ENABLE', 'KEY_REVOKE', 'KEY_SCOPES'));
