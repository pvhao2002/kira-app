CREATE TABLE investment_reconciliation_reports
(
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id               BIGINT        NOT NULL,
  investment_account_id BIGINT        NOT NULL,
  transaction_id        BIGINT        NOT NULL,
  reason                VARCHAR(40)   NOT NULL,
  detail                VARCHAR(1000) NOT NULL,
  status                VARCHAR(30)   NOT NULL DEFAULT 'OPEN',
  resolution_note       TEXT,
  resolved_at           TIMESTAMP(6),
  created_at            TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by            BIGINT,
  updated_at            TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by            BIGINT,
  version               BIGINT        NOT NULL DEFAULT 0,
  deleted_at            TIMESTAMP(6),
  CONSTRAINT fk_invest_report_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_invest_report_account FOREIGN KEY (investment_account_id) REFERENCES investment_accounts (id),
  CONSTRAINT fk_invest_report_transaction FOREIGN KEY (transaction_id) REFERENCES investment_account_transactions (id),
  INDEX idx_invest_report_user_status (user_id, status, created_at),
  INDEX idx_invest_report_transaction (transaction_id, status),
  CONSTRAINT chk_invest_report_reason CHECK (reason IN
                                             ('AMOUNT_MISMATCH', 'DUPLICATE_TRANSACTION', 'AI_EXTRACTION_ERROR',
                                              'COUNTERPARTY_INFO_MISMATCH', 'OTHER')),
  CONSTRAINT chk_invest_report_status CHECK (status IN ('OPEN', 'IN_REVIEW', 'NEEDS_INFO', 'RESOLVED', 'REJECTED'))
);
