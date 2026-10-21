ALTER TABLE users ADD COLUMN uploaded_bytes BIGINT NOT NULL DEFAULT 0;

CREATE TABLE user_ai_usage
(
  user_id    BIGINT NOT NULL,
  usage_date DATE   NOT NULL,
  call_count INT    NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date),
  CONSTRAINT fk_user_ai_usage_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Backfill: R2 uploads keep attachment rows (soft delete); travel files only while they still exist.
UPDATE users u
SET u.uploaded_bytes = COALESCE((SELECT SUM(a.size_bytes) FROM attachments a WHERE a.user_id = u.id), 0)
                     + COALESCE((SELECT SUM(f.size_bytes) FROM travel_files f
                                 JOIN travel_trips t ON t.id = f.trip_id WHERE t.user_id = u.id), 0),
    u.updated_at = u.updated_at;
