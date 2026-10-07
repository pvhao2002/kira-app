CREATE TABLE push_devices
(
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  token      VARCHAR(255) NOT NULL,
  platform   VARCHAR(20)  NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by BIGINT,
  version    BIGINT       NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP(6),
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE KEY uk_push_devices_token (token),
  INDEX idx_push_devices_user (user_id)
);
