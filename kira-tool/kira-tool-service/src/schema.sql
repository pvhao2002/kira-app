-- Runs on every start against a persistent SQLite file DB; CREATE ... IF NOT EXISTS never alters existing tables.
-- Schema changes must be additive: append ALTER TABLE tool_job ADD COLUMN ... below (guarded by the caller).
-- Timestamps are ISO-8601 UTC strings from Date#toISOString (fixed width, so text order = time order).
CREATE TABLE IF NOT EXISTS tool_job (
    id              TEXT    PRIMARY KEY,
    owner           TEXT    NOT NULL,
    provider        TEXT    NOT NULL,
    source_id       TEXT    NOT NULL,
    canonical_url   TEXT    NOT NULL,
    idempotency_key TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    stage           TEXT,
    progress        INTEGER NOT NULL DEFAULT 0,
    error_code      TEXT,
    attempts        INTEGER NOT NULL DEFAULT 0,
    display_name    TEXT,
    file_size       INTEGER,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    finished_at     TEXT,
    expires_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool_job_owner_created ON tool_job (owner, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_job_status ON tool_job (status);
