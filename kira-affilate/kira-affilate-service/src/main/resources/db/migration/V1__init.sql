CREATE TABLE users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at    DATETIME(6)  NOT NULL,
  created_by    BIGINT       NULL,
  updated_at    DATETIME(6)  NOT NULL,
  updated_by    BIGINT       NULL,
  version       BIGINT       NOT NULL DEFAULT 0,
  deleted_at    DATETIME(6)  NULL,
  CONSTRAINT uk_users_email UNIQUE (email),
  CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'LOCKED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT      NOT NULL,
  token_hash       CHAR(64)    NOT NULL,
  family_id        CHAR(36)    NOT NULL,
  expires_at       DATETIME(6) NOT NULL,
  revoked_at       DATETIME(6) NULL,
  replaced_by_hash CHAR(64)    NULL,
  created_at       DATETIME(6) NOT NULL,
  created_by       BIGINT      NULL,
  updated_at       DATETIME(6) NOT NULL,
  updated_by       BIGINT      NULL,
  version          BIGINT      NOT NULL DEFAULT 0,
  deleted_at       DATETIME(6) NULL,
  CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_family (family_id),
  INDEX idx_refresh_tokens_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE shopee_credentials (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id            BIGINT       NOT NULL,
  app_id             VARCHAR(32)  NOT NULL,
  secret_enc         VARCHAR(512) NOT NULL,
  last_checked_at    DATETIME(6)  NULL,
  last_status        VARCHAR(30)  NULL,
  last_error_code    INT          NULL,
  last_error_message VARCHAR(255) NULL,
  created_at         DATETIME(6)  NOT NULL,
  updated_at         DATETIME(6)  NOT NULL,
  CONSTRAINT uk_shopee_credentials_user UNIQUE (user_id),
  CONSTRAINT fk_shopee_credentials_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- utm_key = sub IDs joined with '-', the form Shopee reports back in conversionReport.utmContent.
CREATE TABLE campaigns (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT       NOT NULL,
  name       VARCHAR(120) NOT NULL,
  utm_key    VARCHAR(255) NOT NULL,
  created_at DATETIME(6)  NOT NULL,
  CONSTRAINT uk_campaigns_user_name UNIQUE (user_id, name),
  CONSTRAINT uk_campaigns_user_utm UNIQUE (user_id, utm_key),
  CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE affiliate_links (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT        NOT NULL,
  origin_url  VARCHAR(2048) NOT NULL,
  short_link  VARCHAR(255)  NULL,
  utm_key     VARCHAR(255)  NOT NULL DEFAULT '',
  campaign_id BIGINT        NULL,
  status      VARCHAR(10)   NOT NULL,
  error       VARCHAR(255)  NULL,
  created_at  DATETIME(6)   NOT NULL,
  CONSTRAINT ck_affiliate_links_status CHECK (status IN ('OK', 'FAILED')),
  CONSTRAINT fk_affiliate_links_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_affiliate_links_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL,
  INDEX idx_affiliate_links_user_created (user_id, created_at),
  INDEX idx_affiliate_links_user_campaign (user_id, campaign_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE conversions (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT         NOT NULL,
  conversion_id     VARCHAR(40)    NOT NULL,
  purchase_time     DATETIME(6)    NOT NULL,
  click_time        DATETIME(6)    NULL,
  utm_content       VARCHAR(255)   NOT NULL DEFAULT '',
  buyer_type        VARCHAR(20)    NULL,
  device            VARCHAR(20)    NULL,
  referrer          VARCHAR(255)   NULL,
  total_commission  DECIMAL(18, 2) NOT NULL DEFAULT 0,
  seller_commission DECIMAL(18, 2) NOT NULL DEFAULT 0,
  shopee_commission DECIMAL(18, 2) NOT NULL DEFAULT 0,
  net_commission    DECIMAL(18, 2) NOT NULL DEFAULT 0,
  validation_id     BIGINT         NULL,
  validated_at      DATETIME(6)    NULL,
  synced_at         DATETIME(6)    NOT NULL,
  CONSTRAINT uk_conversions_user_conversion UNIQUE (user_id, conversion_id),
  CONSTRAINT fk_conversions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_conversions_user_purchase (user_id, purchase_time),
  INDEX idx_conversions_user_utm (user_id, utm_content),
  INDEX idx_conversions_user_validation (user_id, validation_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- One row per purchased item. purchase_time is copied from the conversion so report range scans need no join.
CREATE TABLE conversion_items (
  id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id                BIGINT         NOT NULL,
  conversion_id          VARCHAR(40)    NOT NULL,
  order_id               VARCHAR(40)    NOT NULL,
  item_id                VARCHAR(40)    NOT NULL,
  model_id               VARCHAR(40)    NOT NULL DEFAULT '',
  purchase_time          DATETIME(6)    NOT NULL,
  order_status           VARCHAR(30)    NOT NULL,
  fraud_status           VARCHAR(20)    NULL,
  item_name              VARCHAR(512)   NULL,
  shop_id                VARCHAR(40)    NULL,
  shop_name              VARCHAR(255)   NULL,
  image_url              VARCHAR(512)   NULL,
  category_lv1           VARCHAR(255)   NULL,
  qty                    INT            NOT NULL DEFAULT 0,
  item_price             DECIMAL(18, 2) NOT NULL DEFAULT 0,
  actual_amount          DECIMAL(18, 2) NOT NULL DEFAULT 0,
  refund_amount          DECIMAL(18, 2) NOT NULL DEFAULT 0,
  item_total_commission  DECIMAL(18, 2) NOT NULL DEFAULT 0,
  item_seller_commission DECIMAL(18, 2) NOT NULL DEFAULT 0,
  item_shopee_commission DECIMAL(18, 2) NOT NULL DEFAULT 0,
  complete_time          DATETIME(6)    NULL,
  item_notes             VARCHAR(512)   NULL,
  synced_at              DATETIME(6)    NOT NULL,
  CONSTRAINT uk_conversion_items_natural UNIQUE (user_id, conversion_id, order_id, item_id, model_id),
  CONSTRAINT fk_conversion_items_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_conversion_items_user_purchase (user_id, purchase_time),
  INDEX idx_conversion_items_user_status (user_id, order_status, purchase_time),
  INDEX idx_conversion_items_user_order (user_id, order_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE validations (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT      NOT NULL,
  validation_id BIGINT      NOT NULL,
  imported_at   DATETIME(6) NOT NULL,
  CONSTRAINT uk_validations_user_validation UNIQUE (user_id, validation_id),
  CONSTRAINT fk_validations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE sync_runs (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT       NOT NULL,
  kind          VARCHAR(20)  NOT NULL,
  trigger_type  VARCHAR(20)  NOT NULL,
  status        VARCHAR(20)  NOT NULL,
  started_at    DATETIME(6)  NOT NULL,
  finished_at   DATETIME(6)  NULL,
  rows_upserted INT          NOT NULL DEFAULT 0,
  error_code    VARCHAR(40)  NULL,
  error_message VARCHAR(255) NULL,
  CONSTRAINT ck_sync_runs_kind CHECK (kind IN ('CONVERSIONS', 'VALIDATION')),
  CONSTRAINT ck_sync_runs_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'RATE_LIMITED')),
  CONSTRAINT fk_sync_runs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_sync_runs_user_started (user_id, started_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
