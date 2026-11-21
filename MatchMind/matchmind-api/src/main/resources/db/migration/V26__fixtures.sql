-- Cross-provider match identity (UX-047): a fixture groups the matches rows of one real game, across providers and
-- spelling variants. Each provider still owns its matches row and result; predictions and settlement are untouched.
-- matches.fixture_id is the only mutable link; every change of it is logged in fixture_link_history (append-only).

CREATE TABLE fixtures (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    norm_home  VARCHAR(160) NOT NULL,
    norm_away  VARCHAR(160) NOT NULL,
    start_time TIMESTAMPTZ  NOT NULL,
    league     VARCHAR(160),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users (id)
);
CREATE INDEX ix_fixtures_key ON fixtures (norm_home, norm_away, start_time);

ALTER TABLE matches ADD COLUMN fixture_id UUID REFERENCES fixtures (id);
CREATE INDEX ix_matches_fixture ON matches (fixture_id);

CREATE TABLE fixture_link_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID        NOT NULL REFERENCES matches (id),
    from_fixture_id UUID REFERENCES fixtures (id),
    to_fixture_id   UUID REFERENCES fixtures (id),
    source          VARCHAR(16) NOT NULL CHECK (source IN ('AUTO', 'ADMIN_MERGE', 'ADMIN_UNLINK', 'BACKFILL')),
    reason          TEXT,
    changed_by      UUID REFERENCES users (id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_fixture_link_admin_reason CHECK (source NOT LIKE 'ADMIN%'
        OR (reason IS NOT NULL AND btrim(reason) <> '' AND changed_by IS NOT NULL))
);
CREATE INDEX ix_fixture_link_history_match ON fixture_link_history (match_id, changed_at DESC);

-- V23 rule: history is append-only in the database itself.
CREATE TRIGGER trg_fixture_link_history_immutable BEFORE UPDATE OR DELETE ON fixture_link_history
    FOR EACH ROW EXECUTE FUNCTION mm_forbid_change();
CREATE TRIGGER trg_fixture_link_history_no_truncate BEFORE TRUNCATE ON fixture_link_history
    FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change();
