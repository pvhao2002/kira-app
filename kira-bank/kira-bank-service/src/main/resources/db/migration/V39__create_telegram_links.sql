CREATE TABLE IF NOT EXISTS telegram_links
(
  user_id              BIGINT PRIMARY KEY,
  chat_id              BIGINT       NULL,
  link_code_hash       CHAR(64)     NULL,
  link_code_expires_at TIMESTAMP(6) NULL,
  linked_at            TIMESTAMP(6) NULL,
  updated_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_telegram_links_chat UNIQUE (chat_id),
  CONSTRAINT uk_telegram_links_code UNIQUE (link_code_hash),
  CONSTRAINT fk_telegram_links_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
