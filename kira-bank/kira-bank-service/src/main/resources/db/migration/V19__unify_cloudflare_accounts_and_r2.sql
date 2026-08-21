RENAME TABLE ai_provider_accounts TO cloudflare_accounts;

ALTER TABLE cloudflare_accounts
  CHANGE api_token_ciphertext ai_api_token_ciphertext TEXT NOT NULL,
  CHANGE priority_order ai_priority_order INT NOT NULL,
  CHANGE enabled ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CHANGE health_status ai_health_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_TEST',
  CHANGE cooldown_until ai_cooldown_until TIMESTAMP(6) NULL,
  CHANGE last_error_code ai_last_error_code VARCHAR(80) NULL,
  CHANGE last_error_at ai_last_error_at TIMESTAMP(6) NULL,
  CHANGE last_tested_at ai_last_tested_at TIMESTAMP(6) NULL,
  CHANGE last_success_at ai_last_success_at TIMESTAMP(6) NULL,
  ADD COLUMN ai_model VARCHAR(180) NOT NULL DEFAULT '@cf/moonshotai/kimi-k2.7-code' AFTER ai_api_token_ciphertext,
  ADD COLUMN r2_access_key_ciphertext TEXT NULL AFTER ai_last_success_at,
  ADD COLUMN r2_secret_key_ciphertext TEXT NULL AFTER r2_access_key_ciphertext,
  ADD COLUMN r2_bucket_name VARCHAR(255) NULL AFTER r2_secret_key_ciphertext,
  ADD COLUMN r2_public_url VARCHAR(500) NULL AFTER r2_bucket_name,
  ADD COLUMN r2_primary BOOLEAN NOT NULL DEFAULT FALSE AFTER r2_public_url,
  ADD COLUMN r2_health_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_TEST' AFTER r2_primary,
  ADD COLUMN r2_last_error_code VARCHAR(80) NULL AFTER r2_health_status,
  ADD COLUMN r2_last_error_at TIMESTAMP(6) NULL AFTER r2_last_error_code,
  ADD COLUMN r2_last_tested_at TIMESTAMP(6) NULL AFTER r2_last_error_at,
  ADD COLUMN r2_last_success_at TIMESTAMP(6) NULL AFTER r2_last_tested_at,
  ADD COLUMN active_r2_primary TINYINT GENERATED ALWAYS AS
    (CASE WHEN deleted_at IS NULL AND r2_primary = TRUE THEN 1 ELSE NULL END) STORED,
  ADD UNIQUE KEY uk_cloudflare_single_r2_primary (active_r2_primary);

ALTER TABLE attachments
  ADD COLUMN r2_account_id BIGINT NULL AFTER storage_key,
  ADD INDEX idx_attachments_r2_account_id (r2_account_id),
  ADD CONSTRAINT fk_attachments_r2_account
    FOREIGN KEY (r2_account_id) REFERENCES cloudflare_accounts (id);
