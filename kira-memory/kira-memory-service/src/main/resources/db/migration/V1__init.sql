CREATE TABLE users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(10)  NOT NULL,
  display_name  VARCHAR(50)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The only two accounts. There is no registration. Password: 14062018 (bcrypt).
INSERT INTO users (username, password_hash, role, display_name) VALUES
  ('admin', '$2y$10$dZ/whZTIG9AjCiZv5usOYuPjgt7yxjFD.iHrRi5VP7nuo5Oc4CVRu', 'ADMIN', 'Anh'),
  ('love',  '$2y$10$R7zbi0A4QeywYrUYb17BQ.6REq1DCU6TdyfKINmya0G8S3/jrWxvm', 'VIEWER', 'Em');

CREATE TABLE memory_group (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
  pinned_at  DATETIME(3)  NULL,
  created_at DATETIME(3)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  kind          VARCHAR(10)  NOT NULL,
  provider      VARCHAR(20)  NOT NULL,
  object_key    VARCHAR(300) NOT NULL,
  thumb_key     VARCHAR(300) NOT NULL,
  content_type  VARCHAR(100) NOT NULL,
  size_bytes    BIGINT       NOT NULL,
  width         INT          NULL,
  height        INT          NULL,
  caption       TEXT         NULL,
  group_id      BIGINT       NULL,
  taken_at      DATETIME(3)  NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  created_by    BIGINT       NOT NULL,
  CONSTRAINT fk_media_group FOREIGN KEY (group_id) REFERENCES memory_group (id) ON DELETE SET NULL,
  CONSTRAINT fk_media_user FOREIGN KEY (created_by) REFERENCES users (id),
  INDEX ix_media_feed (taken_at, id),
  INDEX ix_media_group_feed (group_id, taken_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  author_id  BIGINT      NOT NULL,
  body       TEXT        NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_message_user FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE app_setting (
  name  VARCHAR(50)  PRIMARY KEY,
  value VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_setting (name, value) VALUES ('storage_provider', 'HUGGING_FACE'), ('widget_shape', 'heart');
