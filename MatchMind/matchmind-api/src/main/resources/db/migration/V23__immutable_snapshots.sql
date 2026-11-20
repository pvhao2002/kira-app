-- UX-088: prediction snapshots are immutable and settlement history is append-only in the database itself, not only in
-- JPA. Triggers fire for superusers and table owners too. A deliberate data fix is a reviewed migration that does
-- ALTER TABLE ... DISABLE TRIGGER ...; <fix>; ALTER TABLE ... ENABLE TRIGGER ... (no escape hatch in application code).
-- A violation is a bug, never a user error: SQLSTATE P0001, message 'MM_IMMUTABLE: <table>'.

CREATE FUNCTION mm_forbid_change() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001';
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['predictions', 'prediction_odds', 'prediction_stats', 'prediction_simulations',
                             'prediction_picks', 'prediction_correct_scores', 'match_result_history'] LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION mm_forbid_change()',
                       'trg_' || t || '_immutable', t);
        EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change()',
                       'trg_' || t || '_no_truncate', t);
    END LOOP;
END $$;

-- prediction_pick_results: the only legal change is superseding the current row (SettlementService.replace):
-- is_current true -> false, superseded_at NULL -> ts, superseded_by NULL -> id, each at most once. Nothing else moves.
CREATE FUNCTION mm_pick_result_supersede_only() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001';
    END IF;
    IF (NEW.id, NEW.pick_id, NEW.result, NEW.settled_at, NEW.details, NEW.source, NEW.calculation_version, NEW.reason,
        NEW.created_by)
       IS DISTINCT FROM
       (OLD.id, OLD.pick_id, OLD.result, OLD.settled_at, OLD.details, OLD.source, OLD.calculation_version, OLD.reason,
        OLD.created_by)
       OR (NEW.is_current AND NOT OLD.is_current)
       OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at)
       OR (OLD.superseded_by IS NOT NULL AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by)
    THEN
        RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_prediction_pick_results_supersede_only BEFORE UPDATE OR DELETE ON prediction_pick_results
    FOR EACH ROW EXECUTE FUNCTION mm_pick_result_supersede_only();
CREATE TRIGGER trg_prediction_pick_results_no_truncate BEFORE TRUNCATE ON prediction_pick_results
    FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change();
