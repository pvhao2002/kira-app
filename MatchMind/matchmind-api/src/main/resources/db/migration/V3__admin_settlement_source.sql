-- An admin settling a match's pending picks is not a recalculation of an existing result: give it its own source.
ALTER TABLE prediction_pick_results DROP CONSTRAINT prediction_pick_results_source_check;
ALTER TABLE prediction_pick_results ADD CONSTRAINT prediction_pick_results_source_check
    CHECK (source IN ('AUTO', 'EXTERNAL_REQUEST', 'ADMIN_SETTLEMENT', 'ADMIN_RECALCULATION', 'ADMIN_OVERRIDE'));
