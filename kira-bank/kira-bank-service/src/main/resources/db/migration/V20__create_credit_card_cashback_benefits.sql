CREATE TABLE user_card_cashback_configs
(
  id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_card_id         BIGINT         NOT NULL,
  monthly_cashback_cap DECIMAL(19, 4) NOT NULL,
  created_at           TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by           BIGINT,
  updated_at           TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by           BIGINT,
  version              BIGINT         NOT NULL DEFAULT 0,
  deleted_at           TIMESTAMP(6),
  CONSTRAINT fk_cashback_config_card FOREIGN KEY (user_card_id) REFERENCES user_credit_cards (id),
  UNIQUE KEY uk_cashback_config_card (user_card_id)
);

CREATE TABLE credit_card_cashback_programs
(
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_card_id BIGINT       NOT NULL,
  name         VARCHAR(150) NOT NULL,
  notes        TEXT,
  terms_url    VARCHAR(500),
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by   BIGINT,
  updated_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by   BIGINT,
  version      BIGINT       NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMP(6),
  CONSTRAINT fk_cashback_program_card FOREIGN KEY (user_card_id) REFERENCES user_credit_cards (id),
  INDEX idx_cashback_program_card (user_card_id, deleted_at, active)
);

CREATE TABLE credit_card_cashback_rules
(
  id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
  program_id          BIGINT         NOT NULL,
  category_name       VARCHAR(150)   NOT NULL,
  display_order       INT            NOT NULL,
  cashback_rate       DECIMAL(7, 4)  NOT NULL,
  max_cashback_amount DECIMAL(19, 4) NOT NULL,
  created_at          TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by          BIGINT,
  updated_at          TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by          BIGINT,
  version             BIGINT         NOT NULL DEFAULT 0,
  deleted_at          TIMESTAMP(6),
  CONSTRAINT fk_cashback_rule_program FOREIGN KEY (program_id) REFERENCES credit_card_cashback_programs (id),
  INDEX idx_cashback_rule_program (program_id, deleted_at)
);

CREATE TABLE credit_card_cashback_rule_mccs
(
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  rule_id    BIGINT       NOT NULL,
  mcc_code   CHAR(4)      NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by BIGINT,
  version    BIGINT       NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP(6),
  CONSTRAINT fk_cashback_rule_mcc_rule FOREIGN KEY (rule_id) REFERENCES credit_card_cashback_rules (id),
  UNIQUE KEY uk_cashback_rule_mcc (rule_id, mcc_code),
  INDEX idx_cashback_rule_mcc_active (rule_id, deleted_at)
);
