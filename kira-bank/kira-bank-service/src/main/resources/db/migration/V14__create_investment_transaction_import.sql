ALTER TABLE attachments
  ADD COLUMN ai_schema_version INT NULL AFTER ai_model,
  ADD COLUMN storage_purged_at TIMESTAMP(6) NULL AFTER ai_confirmed_at,
  ADD INDEX idx_attachment_ai_hash (user_id, module, document_type, sha256, ai_schema_version, storage_purged_at);

CREATE TABLE investment_transaction_import_batches
(
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id              CHAR(36)     NOT NULL,
  user_id               BIGINT       NOT NULL,
  investment_account_id BIGINT       NOT NULL,
  status                VARCHAR(30)  NOT NULL,
  file_count            INT          NOT NULL DEFAULT 0,
  detected_count        INT          NOT NULL DEFAULT 0,
  inserted_count        INT          NOT NULL DEFAULT 0,
  updated_count         INT          NOT NULL DEFAULT 0,
  skipped_count         INT          NOT NULL DEFAULT 0,
  failed_count          INT          NOT NULL DEFAULT 0,
  review_count          INT          NOT NULL DEFAULT 0,
  completed_at          TIMESTAMP(6),
  retention_until       TIMESTAMP(6),
  created_at            TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by            BIGINT,
  updated_at            TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by            BIGINT,
  version               BIGINT       NOT NULL DEFAULT 0,
  deleted_at            TIMESTAMP(6),
  CONSTRAINT fk_invest_import_batch_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_invest_import_batch_account FOREIGN KEY (investment_account_id) REFERENCES investment_accounts (id),
  CONSTRAINT uq_invest_import_batch_id UNIQUE (batch_id),
  INDEX idx_invest_import_batch_owner_created (user_id, created_at),
  INDEX idx_invest_import_batch_account_created (investment_account_id, created_at),
  INDEX idx_invest_import_batch_retention (status, retention_until),
  CONSTRAINT chk_invest_import_batch_status CHECK (status IN
    ('QUEUED', 'PROCESSING', 'READY', 'READY_WITH_ERRORS', 'PARTIALLY_CONFIRMED', 'CONFIRMED', 'FAILED'))
);

CREATE TABLE investment_transaction_import_files
(
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id      BIGINT       NOT NULL,
  attachment_id BIGINT       NOT NULL,
  status        VARCHAR(30)  NOT NULL,
  error_code    VARCHAR(100),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by    BIGINT,
  updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by    BIGINT,
  version       BIGINT       NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMP(6),
  CONSTRAINT fk_invest_import_file_batch FOREIGN KEY (batch_id) REFERENCES investment_transaction_import_batches (id),
  CONSTRAINT fk_invest_import_file_attachment FOREIGN KEY (attachment_id) REFERENCES attachments (id),
  CONSTRAINT uq_invest_import_file UNIQUE (batch_id, attachment_id),
  INDEX idx_invest_import_file_attachment (attachment_id),
  CONSTRAINT chk_invest_import_file_status CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'CONFIRMED'))
);

CREATE TABLE investment_account_transactions
(
  id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id                 BIGINT         NOT NULL,
  investment_account_id   BIGINT         NOT NULL,
  transaction_type        VARCHAR(30)    NOT NULL,
  transaction_status      VARCHAR(30)    NOT NULL,
  amount                  DECIMAL(19, 4) NOT NULL,
  currency                CHAR(3)        NOT NULL,
  transaction_at          TIMESTAMP(6)   NOT NULL,
  external_transaction_id VARCHAR(150),
  description             VARCHAR(1000),
  raw_text                 TEXT,
  ai_extraction_data       JSON,
  ai_confidence            DECIMAL(5, 4),
  deduplication_key       BINARY(32)     NOT NULL,
  source_file_hash        CHAR(64),
  source_attachment_id    BIGINT,
  created_at              TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by              BIGINT,
  updated_at              TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by              BIGINT,
  version                 BIGINT         NOT NULL DEFAULT 0,
  deleted_at              TIMESTAMP(6),
  CONSTRAINT fk_invest_transaction_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_invest_transaction_account FOREIGN KEY (investment_account_id) REFERENCES investment_accounts (id),
  CONSTRAINT fk_invest_transaction_attachment FOREIGN KEY (source_attachment_id) REFERENCES attachments (id),
  CONSTRAINT uq_invest_transaction_dedup UNIQUE (investment_account_id, deduplication_key),
  CONSTRAINT uq_invest_transaction_external UNIQUE (investment_account_id, external_transaction_id),
  INDEX idx_invest_transaction_account_date (investment_account_id, transaction_at),
  INDEX idx_invest_transaction_owner_status (user_id, transaction_status),
  CONSTRAINT chk_invest_transaction_type CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'BONUS')),
  CONSTRAINT chk_invest_transaction_status CHECK (transaction_status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  CONSTRAINT chk_invest_transaction_amount CHECK (amount > 0),
  CONSTRAINT chk_invest_transaction_confidence CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

CREATE TABLE investment_transaction_import_items
(
  id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_id                 CHAR(36)       NOT NULL,
  batch_id                BIGINT         NOT NULL,
  primary_attachment_id   BIGINT         NOT NULL,
  matched_transaction_id  BIGINT,
  confirmed_transaction_id BIGINT,
  transaction_type        VARCHAR(30),
  transaction_status      VARCHAR(30),
  amount                  DECIMAL(19, 4),
  currency                CHAR(3),
  transaction_at          TIMESTAMP(6),
  external_transaction_id VARCHAR(150),
  description             VARCHAR(1000),
  normalized_description  VARCHAR(1000),
  raw_text                 TEXT,
  ai_extraction_data       JSON,
  ai_confidence            DECIMAL(5, 4),
  processing_action       VARCHAR(20)    NOT NULL,
  resolution              VARCHAR(30),
  warnings                JSON,
  deduplication_key       BINARY(32),
  created_at              TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by              BIGINT,
  updated_at              TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by              BIGINT,
  version                 BIGINT         NOT NULL DEFAULT 0,
  deleted_at              TIMESTAMP(6),
  CONSTRAINT fk_invest_import_item_batch FOREIGN KEY (batch_id) REFERENCES investment_transaction_import_batches (id),
  CONSTRAINT fk_invest_import_item_attachment FOREIGN KEY (primary_attachment_id) REFERENCES attachments (id),
  CONSTRAINT fk_invest_import_item_match FOREIGN KEY (matched_transaction_id) REFERENCES investment_account_transactions (id),
  CONSTRAINT fk_invest_import_item_confirmed FOREIGN KEY (confirmed_transaction_id) REFERENCES investment_account_transactions (id),
  CONSTRAINT uq_invest_import_item_id UNIQUE (item_id),
  INDEX idx_invest_import_item_batch_action (batch_id, processing_action),
  CONSTRAINT chk_invest_import_item_action CHECK (processing_action IN ('INSERT', 'UPDATE', 'DUPLICATE', 'REVIEW', 'IGNORE')),
  CONSTRAINT chk_invest_import_item_resolution CHECK (resolution IS NULL OR resolution IN ('ACCEPT', 'MERGE_EXISTING', 'SAVE_AS_NEW', 'SKIP')),
  CONSTRAINT chk_invest_import_item_confidence CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

CREATE TABLE investment_transaction_import_item_sources
(
  import_item_id BIGINT NOT NULL,
  attachment_id  BIGINT NOT NULL,
  PRIMARY KEY (import_item_id, attachment_id),
  CONSTRAINT fk_invest_import_source_item FOREIGN KEY (import_item_id) REFERENCES investment_transaction_import_items (id),
  CONSTRAINT fk_invest_import_source_attachment FOREIGN KEY (attachment_id) REFERENCES attachments (id)
);

CREATE TABLE investment_account_transaction_sources
(
  transaction_id BIGINT NOT NULL,
  attachment_id  BIGINT NOT NULL,
  PRIMARY KEY (transaction_id, attachment_id),
  CONSTRAINT fk_invest_transaction_source_transaction FOREIGN KEY (transaction_id) REFERENCES investment_account_transactions (id),
  CONSTRAINT fk_invest_transaction_source_attachment FOREIGN KEY (attachment_id) REFERENCES attachments (id)
);
