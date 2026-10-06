CREATE TABLE login_history
(
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  client_ip  VARCHAR(45)  NULL,
  server_ip  VARCHAR(45)  NOT NULL,
  ip_source  VARCHAR(16)  NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_login_history_user_time (user_id, created_at)
);
