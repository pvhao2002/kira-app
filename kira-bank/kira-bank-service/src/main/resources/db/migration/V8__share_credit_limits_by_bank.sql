CREATE TABLE user_bank_credit_limits
(
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT         NOT NULL,
  bank_id      BIGINT         NOT NULL,
  credit_limit DECIMAL(19, 4) NOT NULL,
  currency     CHAR(3)        NOT NULL DEFAULT 'VND',
  created_at   TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by   BIGINT,
  updated_at   TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by   BIGINT,
  version      BIGINT         NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMP(6),
  CONSTRAINT fk_user_bank_credit_limits_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_user_bank_credit_limits_bank FOREIGN KEY (bank_id) REFERENCES banks (id),
  CONSTRAINT uk_user_bank_credit_limits_owner_bank UNIQUE (user_id, bank_id),
  CHECK (credit_limit > 0)
);

INSERT INTO user_bank_credit_limits
  (user_id, bank_id, credit_limit, currency, created_at, created_by, updated_at, updated_by, version, deleted_at)
SELECT user_id,
       bank_id,
       MAX(credit_limit),
       MAX(currency),
       MIN(created_at),
       MIN(created_by),
       MAX(updated_at),
       MAX(updated_by),
       0,
       NULL
FROM user_credit_cards
GROUP BY user_id, bank_id;

ALTER TABLE user_credit_cards
  DROP COLUMN credit_limit;
