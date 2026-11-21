-- League aliases (UX-086): agents name leagues freely ("EPL", "English Premier League"), so an admin maps a variant
-- name to one canonical name. The league filter, the league dropdown and the report "by league" breakdown resolve
-- names through mm_league(). Stored match rows keep the name the agent sent.
CREATE TABLE league_aliases (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    alias      VARCHAR(160) NOT NULL,
    canonical  VARCHAR(160) NOT NULL,
    created_by UUID         REFERENCES users (id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_league_aliases_not_blank CHECK (btrim(alias) <> '' AND btrim(canonical) <> ''),
    CONSTRAINT ck_league_aliases_not_self CHECK (mm_fold(btrim(alias)) <> mm_fold(btrim(canonical)))
);
-- One canonical name per alias, compared like the league filter (trimmed, case-, accent- and Unicode-form-insensitive).
CREATE UNIQUE INDEX ux_league_aliases_alias ON league_aliases (mm_fold(btrim(alias)));

-- No chains: an alias is never also a canonical name, so one lookup resolves any name. The service takes a table
-- lock before inserting, so two concurrent inserts (A->B, B->C) cannot both pass this check.
CREATE FUNCTION mm_league_aliases_no_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM league_aliases
               WHERE mm_fold(btrim(canonical)) = mm_fold(btrim(NEW.alias))
                  OR mm_fold(btrim(alias)) = mm_fold(btrim(NEW.canonical))) THEN
        RAISE EXCEPTION 'league alias chain: % -> %', NEW.alias, NEW.canonical USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_league_aliases_no_chain BEFORE INSERT OR UPDATE ON league_aliases
    FOR EACH ROW EXECUTE FUNCTION mm_league_aliases_no_chain();

-- The canonical name of a league: its alias target, else the name itself (trimmed). STABLE: it reads the table.
-- ponytail: one indexed lookup per row; fine for the league filter at this data size, add a materialised
-- league_key column on matches if league filters get slow.
CREATE FUNCTION mm_league(text) RETURNS text
    LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$ SELECT COALESCE((SELECT canonical FROM public.league_aliases WHERE mm_fold(btrim(alias)) = mm_fold(btrim($1))), btrim($1)) $$;

-- Alias changes go to the append-only admin log: MERGE when added, UNMERGE when removed.
ALTER TABLE admin_actions DROP CONSTRAINT admin_actions_entity_check;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_entity_check
    CHECK (entity IN ('PROVIDER', 'MODEL', 'MATCH', 'LEAGUE_ALIAS'));
