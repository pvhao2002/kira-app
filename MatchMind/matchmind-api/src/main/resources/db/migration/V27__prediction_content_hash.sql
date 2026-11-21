-- UX-046 (report part): identify exact re-sends of a prediction without touching the immutable snapshot.
-- JSONB text output is canonical (sorted keys, normalised whitespace), so the hash of the payload without the fields an
-- agent changes on a retry (eventId, predictedAt, metadata) names "the same content". PostgreSQL computes it for the
-- existing rows while it rewrites the table: ALTER TABLE fires no row triggers, so the V23 immutability triggers stay
-- enabled and no DISABLE TRIGGER is needed. New rows get it on INSERT; nothing ever UPDATEs a prediction.
ALTER TABLE predictions ADD COLUMN content_hash CHAR(32)
    GENERATED ALWAYS AS (md5((payload - 'eventId' - 'predictedAt' - 'metadata')::text)) STORED;

-- "Latest counts" (Stats.COUNTED) looks up later rows of the same match, model, type and minute.
CREATE INDEX ix_predictions_dedupe ON predictions (match_id, ai_model_id, prediction_type, match_minute, predicted_at DESC);
-- Exact twins for the prediction detail ("similar", exact = same content_hash).
CREATE INDEX ix_predictions_content ON predictions (match_id, ai_model_id, content_hash);
