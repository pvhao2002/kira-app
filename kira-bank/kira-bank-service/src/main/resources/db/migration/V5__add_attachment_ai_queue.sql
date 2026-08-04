ALTER TABLE attachments
  ADD COLUMN ai_attempt_count INT NOT NULL DEFAULT 0 AFTER ai_status,
  ADD COLUMN ai_model VARCHAR(150) NULL AFTER ai_attempt_count,
  ADD COLUMN ai_raw_response LONGTEXT NULL AFTER ai_model,
  ADD COLUMN ai_result JSON NULL AFTER ai_raw_response,
  ADD COLUMN ai_error TEXT NULL AFTER ai_result,
  ADD COLUMN ai_next_attempt_at TIMESTAMP(6) NULL AFTER ai_error,
  ADD COLUMN ai_processing_started_at TIMESTAMP(6) NULL AFTER ai_next_attempt_at,
  ADD COLUMN ai_completed_at TIMESTAMP(6) NULL AFTER ai_processing_started_at,
  ADD COLUMN ai_confirmed_at TIMESTAMP(6) NULL AFTER ai_completed_at;

CREATE INDEX idx_attachment_ai_queue
  ON attachments (module, document_type, ai_status, ai_next_attempt_at, created_at);
