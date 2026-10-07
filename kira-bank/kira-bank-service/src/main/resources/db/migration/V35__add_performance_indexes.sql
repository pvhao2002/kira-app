-- Indexes for query paths found in the performance review. Additive only; no data changes.

-- GET /card-transactions without cardId: user's rows ordered by date (was FK index + filesort).
CREATE INDEX idx_card_tx_user_date ON card_transactions (user_id, deleted_at, transaction_date);

-- Daily statement-import purge: skip already-purged imports instead of rescanning them every run.
CREATE INDEX idx_card_import_purge ON card_statement_imports (storage_purged_at, status, retention_until);

-- Investment flow/statistics by owner over a date range. The new index keeps (user_id, transaction_status) as its
-- prefix, so it replaces the old one (and still backs the user_id foreign key).
ALTER TABLE investment_account_transactions
  ADD INDEX idx_invest_transaction_owner_status_date (user_id, transaction_status, transaction_at),
  DROP INDEX idx_invest_transaction_owner_status;

-- Reconciliation report lists: own list ordered by date, admin list filtered by status.
CREATE INDEX idx_invest_report_user_created ON investment_reconciliation_reports (user_id, created_at);
CREATE INDEX idx_invest_report_status_created ON investment_reconciliation_reports (status, created_at);

-- Notification list: user's rows ordered by created_at (existing index has read_at in the middle).
CREATE INDEX idx_notification_user_created ON notifications (user_id, deleted_at, created_at);

-- Refresh-token reuse detection revokes a whole family by family_id alone.
CREATE INDEX idx_refresh_family ON refresh_tokens (family_id);
