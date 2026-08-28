CREATE TABLE password_vault_modules
(
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id    BIGINT        NOT NULL,
  name        VARCHAR(150)  NOT NULL,
  website_url VARCHAR(1000),
  description VARCHAR(1000),
  created_at  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by  BIGINT,
  updated_at  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by  BIGINT,
  version     BIGINT        NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMP(6),
  CONSTRAINT fk_password_vault_module_owner FOREIGN KEY (owner_id) REFERENCES users (id),
  INDEX idx_password_vault_module_owner (owner_id, deleted_at, name)
);

CREATE TABLE password_vault_accounts
(
  id                       BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id                 BIGINT       NOT NULL,
  module_id                BIGINT       NOT NULL,
  account_uuid             CHAR(36)     NOT NULL,
  display_name             VARCHAR(150) NOT NULL,
  secret_ciphertext        MEDIUMTEXT   NOT NULL,
  secret_nonce             VARCHAR(64)  NOT NULL,
  wrapped_dek_ciphertext   VARCHAR(255) NOT NULL,
  wrapped_dek_nonce        VARCHAR(64)  NOT NULL,
  encryption_key_id        VARCHAR(50)  NOT NULL,
  crypto_version           SMALLINT     NOT NULL,
  created_at               TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by               BIGINT,
  updated_at               TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by               BIGINT,
  version                  BIGINT       NOT NULL DEFAULT 0,
  deleted_at               TIMESTAMP(6),
  CONSTRAINT fk_password_vault_account_owner FOREIGN KEY (owner_id) REFERENCES users (id),
  CONSTRAINT fk_password_vault_account_module FOREIGN KEY (module_id) REFERENCES password_vault_modules (id),
  CONSTRAINT uk_password_vault_account_uuid UNIQUE (account_uuid),
  INDEX idx_password_vault_account_module (owner_id, module_id, deleted_at, display_name)
);

CREATE TABLE password_vault_unlock_sessions
(
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  revoked_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_password_vault_unlock_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT uk_password_vault_unlock_hash UNIQUE (token_hash),
  INDEX idx_password_vault_unlock_user (user_id, expires_at, revoked_at)
);
