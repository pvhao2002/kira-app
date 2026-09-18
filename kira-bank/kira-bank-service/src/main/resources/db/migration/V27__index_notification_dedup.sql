CREATE INDEX idx_notification_dedup
  ON notifications (user_id, type, deep_link(191), deleted_at);
