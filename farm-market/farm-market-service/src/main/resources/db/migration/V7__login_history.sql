-- One row per successful password check. client_ip is self-reported (ipify) and spoofable; server_ip is trusted.
CREATE TABLE login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_ip VARCHAR(45) NULL,
  server_ip VARCHAR(45) NOT NULL,
  ip_source VARCHAR(16) NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_login_history_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
