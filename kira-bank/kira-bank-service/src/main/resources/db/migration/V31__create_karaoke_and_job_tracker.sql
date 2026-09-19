CREATE TABLE karaoke_favorite_songs
(
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT       NOT NULL,
  title        VARCHAR(255) NOT NULL,
  artist       VARCHAR(255),
  genre        VARCHAR(100),
  karaoke_code VARCHAR(100),
  tone         VARCHAR(50),
  link         VARCHAR(1000),
  note         TEXT,
  created_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by   BIGINT,
  updated_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by   BIGINT,
  version      BIGINT       NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMP(6),
  CONSTRAINT fk_karaoke_song_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_karaoke_song_owner_updated (user_id, deleted_at, updated_at),
  INDEX idx_karaoke_song_owner_title (user_id, deleted_at, title)
);

CREATE TABLE job_applications
(
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  company_name    VARCHAR(255) NOT NULL,
  position_title  VARCHAR(255) NOT NULL,
  location        VARCHAR(255),
  job_url         VARCHAR(1000),
  salary          VARCHAR(255),
  employment_type VARCHAR(100),
  status          VARCHAR(30)  NOT NULL DEFAULT 'SAVED',
  priority        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
  deadline        DATE,
  contact_name    VARCHAR(255),
  contact_email   VARCHAR(255),
  notes           TEXT,
  created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by      BIGINT,
  updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  updated_by      BIGINT,
  version         BIGINT       NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMP(6),
  CONSTRAINT fk_job_application_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_job_application_owner_status (user_id, deleted_at, status, updated_at),
  INDEX idx_job_application_owner_deadline (user_id, deleted_at, deadline)
);
