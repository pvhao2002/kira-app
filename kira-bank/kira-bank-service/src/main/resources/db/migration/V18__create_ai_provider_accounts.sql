CREATE TABLE ai_provider_accounts
(
  id                    BIGINT       NOT NULL AUTO_INCREMENT,
  display_name          VARCHAR(100) NOT NULL,
  account_id            VARCHAR(64)  NOT NULL,
  api_token_ciphertext  TEXT         NOT NULL,
  priority_order        INT          NOT NULL,
  enabled               BOOLEAN      NOT NULL DEFAULT FALSE,
  health_status         VARCHAR(30)  NOT NULL DEFAULT 'PENDING_TEST',
  cooldown_until        TIMESTAMP(6) NULL,
  last_error_code       VARCHAR(80)  NULL,
  last_error_at         TIMESTAMP(6) NULL,
  last_tested_at        TIMESTAMP(6) NULL,
  last_success_at       TIMESTAMP(6) NULL,
  created_at            TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by            BIGINT       NULL,
  updated_at            TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by            BIGINT       NULL,
  version               BIGINT       NOT NULL DEFAULT 0,
  deleted_at            TIMESTAMP(6) NULL,
  active_account_id     VARCHAR(64) GENERATED ALWAYS AS
                          (CASE WHEN deleted_at IS NULL THEN account_id ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_provider_active_account_id (active_account_id),
  INDEX idx_ai_provider_account_selection (deleted_at, enabled, priority_order),
  CONSTRAINT fk_ai_provider_account_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_ai_provider_account_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
);
