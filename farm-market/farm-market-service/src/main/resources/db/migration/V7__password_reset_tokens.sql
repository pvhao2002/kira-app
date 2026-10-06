-- Forgot-password tokens. Only the SHA-256 hex of the emailed token is stored; a token is single use (used_at) and
-- short lived (expires_at). The service keeps only the newest token per user.
CREATE TABLE password_reset_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX ix_password_reset_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
