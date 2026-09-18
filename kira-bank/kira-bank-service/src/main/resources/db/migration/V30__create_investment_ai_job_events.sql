CREATE TABLE investment_ai_job_events
(
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  attachment_id BIGINT       NOT NULL,
  from_status   VARCHAR(30),
  to_status     VARCHAR(30)  NOT NULL,
  attempt_count INT          NOT NULL DEFAULT 0,
  reason_code   VARCHAR(100) NOT NULL,
  actor_type    VARCHAR(20)  NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_invest_ai_job_event_attachment FOREIGN KEY (attachment_id) REFERENCES attachments (id),
  INDEX idx_invest_ai_job_event_attachment (attachment_id, created_at, id),
  CONSTRAINT chk_invest_ai_job_event_from_status CHECK (from_status IS NULL OR from_status IN
                                                                               ('NOT_REQUESTED', 'PENDING',
                                                                                'PROCESSING', 'READY', 'FAILED',
                                                                                'CANCELLED', 'CONFIRMED')),
  CONSTRAINT chk_invest_ai_job_event_to_status CHECK (to_status IN
                                                      ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'READY', 'FAILED',
                                                       'CANCELLED', 'CONFIRMED')),
  CONSTRAINT chk_invest_ai_job_event_actor CHECK (actor_type IN ('USER', 'ADMIN', 'SYSTEM'))
);

INSERT INTO investment_ai_job_events
(attachment_id, from_status, to_status, attempt_count, reason_code, actor_type, created_at)
SELECT id,
       NULL,
       ai_status,
       ai_attempt_count,
       'MIGRATED_EXISTING_STATE',
       'SYSTEM',
       COALESCE(created_at, CURRENT_TIMESTAMP(6))
FROM attachments
WHERE module = 'investment'
  AND document_type = 'RECEIPT'
  AND ai_status <> 'NOT_REQUESTED'
  AND deleted_at IS NULL;
