-- Start days of Em's period ("ngày dâu"), logged from either account; the UI predicts the next one from the gaps.
CREATE TABLE cycle_start (
  day        DATE        NOT NULL PRIMARY KEY,
  created_by BIGINT      NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_cycle_start_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
