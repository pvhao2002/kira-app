-- Investment screenshot import without batches: receipts link straight to an account, valid rows are auto-recorded.
-- Approved destructive change: reconciliation reports and import batches are dropped.

-- Reconciliation reports removed (events first: fk_invest_report_event_report)
DROP TABLE investment_reconciliation_report_events;
DROP TABLE investment_reconciliation_reports;

-- Import file -> account/attachment link
ALTER TABLE investment_transaction_import_files
  ADD COLUMN investment_account_id BIGINT NULL AFTER id,
  ADD COLUMN processed_at TIMESTAMP(6) NULL AFTER attachment_id;

UPDATE investment_transaction_import_files f
  JOIN investment_transaction_import_batches b ON b.id = f.batch_id
SET f.investment_account_id = b.investment_account_id,
    f.processed_at = CASE WHEN f.status IN ('READY', 'CONFIRMED') THEN f.updated_at END;

-- Same attachment linked to the same account by several batches: keep the oldest row
UPDATE investment_transaction_import_files older
  JOIN investment_transaction_import_files newer
    ON newer.investment_account_id = older.investment_account_id
   AND newer.attachment_id = older.attachment_id AND newer.id > older.id
SET older.processed_at = COALESCE(older.processed_at, newer.processed_at);

DELETE newer FROM investment_transaction_import_files newer
  JOIN investment_transaction_import_files older
    ON older.investment_account_id = newer.investment_account_id
   AND older.attachment_id = newer.attachment_id AND older.id < newer.id;

ALTER TABLE investment_transaction_import_files
  DROP FOREIGN KEY fk_invest_import_file_batch,
  DROP CHECK chk_invest_import_file_status;

ALTER TABLE investment_transaction_import_files
  DROP INDEX uq_invest_import_file,
  DROP COLUMN batch_id,
  DROP COLUMN status,
  DROP COLUMN error_code,
  MODIFY investment_account_id BIGINT NOT NULL,
  ADD CONSTRAINT uq_invest_import_file_account_attachment UNIQUE (investment_account_id, attachment_id),
  ADD CONSTRAINT fk_invest_import_file_account FOREIGN KEY (investment_account_id) REFERENCES investment_accounts (id);

-- Items belong to an account instead of a batch
ALTER TABLE investment_transaction_import_items
  ADD COLUMN investment_account_id BIGINT NULL AFTER item_id;

UPDATE investment_transaction_import_items i
  JOIN investment_transaction_import_batches b ON b.id = i.batch_id
SET i.investment_account_id = b.investment_account_id;

ALTER TABLE investment_transaction_import_items
  DROP FOREIGN KEY fk_invest_import_item_batch;

ALTER TABLE investment_transaction_import_items
  DROP INDEX idx_invest_import_item_batch_action,
  DROP COLUMN batch_id,
  MODIFY investment_account_id BIGINT NOT NULL,
  ADD INDEX idx_invest_import_item_account_open (investment_account_id, confirmed_transaction_id),
  ADD CONSTRAINT fk_invest_import_item_account FOREIGN KEY (investment_account_id) REFERENCES investment_accounts (id);

DROP TABLE investment_transaction_import_batches;

-- Append-only history of manual edits to ledger transactions (rows are never updated or deleted)
CREATE TABLE investment_account_transaction_edits
(
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  transaction_id BIGINT       NOT NULL,
  edited_by      BIGINT       NOT NULL,
  edited_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  old_values     JSON         NOT NULL,
  new_values     JSON         NOT NULL,
  CONSTRAINT fk_invest_tx_edit_transaction FOREIGN KEY (transaction_id) REFERENCES investment_account_transactions (id),
  CONSTRAINT fk_invest_tx_edit_user FOREIGN KEY (edited_by) REFERENCES users (id),
  INDEX idx_invest_tx_edit_transaction (transaction_id, edited_at)
);
