ALTER TABLE investment_transaction_import_files
  DROP CHECK chk_invest_import_file_status,
  ADD CONSTRAINT chk_invest_import_file_status CHECK
    (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'CONFIRMED'));

ALTER TABLE investment_transaction_import_batches
  DROP CHECK chk_invest_import_batch_status,
  ADD CONSTRAINT chk_invest_import_batch_status CHECK
    (status IN ('QUEUED', 'PROCESSING', 'READY', 'READY_WITH_ERRORS', 'PARTIALLY_CONFIRMED',
                'CONFIRMED', 'FAILED', 'CANCELLED'));
