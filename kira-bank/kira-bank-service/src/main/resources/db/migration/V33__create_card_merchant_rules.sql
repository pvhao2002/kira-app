CREATE TABLE card_merchant_rules
(
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  pattern    VARCHAR(100) NOT NULL,
  mcc_code   CHAR(4)      NOT NULL,
  label      VARCHAR(150),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by BIGINT,
  version    BIGINT       NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP(6),
  CONSTRAINT fk_card_merchant_rule_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT uq_card_merchant_rule_pattern UNIQUE (user_id, pattern),
  CONSTRAINT chk_card_merchant_rule_mcc CHECK (CHAR_LENGTH(mcc_code) = 4),
  CONSTRAINT chk_card_merchant_rule_pattern CHECK (CHAR_LENGTH(pattern) >= 2)
);
