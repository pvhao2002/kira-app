CREATE TABLE IF NOT EXISTS stored_files
(
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider      VARCHAR(20)  NOT NULL,
  storage_key   VARCHAR(500) NOT NULL,
  r2_account_id BIGINT       NULL,
  original_name VARCHAR(200) NOT NULL,
  mime_type     VARCHAR(150) NOT NULL,
  size_bytes    BIGINT       NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by    BIGINT       NULL,
  updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_by    BIGINT       NULL,
  version       BIGINT       NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMP(6) NULL,
  INDEX idx_stored_files_created (deleted_at, created_at)
);
