ALTER TABLE user_bank_credit_limits
  ADD COLUMN balance_version BIGINT NOT NULL DEFAULT 0 AFTER version;

CREATE TABLE user_bank_balance_adjustments
(
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id           BIGINT         NOT NULL,
  bank_id           BIGINT         NOT NULL,
  balance_version   BIGINT         NOT NULL,
  source_balance    DECIMAL(19, 4) NOT NULL,
  previous_balance  DECIMAL(19, 4) NOT NULL,
  new_balance       DECIMAL(19, 4) NOT NULL,
  adjustment_amount DECIMAL(19, 4) NOT NULL,
  balance_offset    DECIMAL(19, 4) NOT NULL,
  reason             VARCHAR(500)   NOT NULL,
  currency           CHAR(3)        NOT NULL DEFAULT 'VND',
  created_at         TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by         BIGINT         NOT NULL,
  CONSTRAINT fk_user_bank_balance_adjustments_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_user_bank_balance_adjustments_bank FOREIGN KEY (bank_id) REFERENCES banks (id),
  CONSTRAINT fk_user_bank_balance_adjustments_limit FOREIGN KEY (user_id, bank_id)
    REFERENCES user_bank_credit_limits (user_id, bank_id),
  CONSTRAINT uk_user_bank_balance_adjustments_version UNIQUE (user_id, bank_id, balance_version),
  CHECK (balance_version > 0),
  CHECK (source_balance >= 0),
  CHECK (previous_balance >= 0),
  CHECK (new_balance >= 0),
  CHECK (CHAR_LENGTH(TRIM(reason)) > 0)
);

CREATE INDEX idx_user_bank_balance_adjustments_latest
  ON user_bank_balance_adjustments (user_id, bank_id, balance_version DESC);
