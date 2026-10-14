CREATE TABLE IF NOT EXISTS telegram_updates
(
  update_id       BIGINT PRIMARY KEY,
  payload         JSON         NULL,
  status          VARCHAR(16)  NOT NULL,
  attempts        INT          NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP(6) NOT NULL,
  created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_telegram_updates_due (status, next_attempt_at)
);
