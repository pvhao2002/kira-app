CREATE TABLE investment_reconciliation_report_events
(
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_id   BIGINT       NOT NULL,
  from_status VARCHAR(30),
  to_status   VARCHAR(30)  NOT NULL,
  note        VARCHAR(2000),
  created_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actor_id    BIGINT       NOT NULL,
  CONSTRAINT fk_invest_report_event_report FOREIGN KEY (report_id) REFERENCES investment_reconciliation_reports (id),
  CONSTRAINT fk_invest_report_event_actor FOREIGN KEY (actor_id) REFERENCES users (id),
  INDEX idx_invest_report_event_report (report_id, created_at, id),
  CONSTRAINT chk_invest_report_event_from_status CHECK (from_status IS NULL OR from_status IN
                                                                               ('OPEN', 'IN_REVIEW', 'NEEDS_INFO',
                                                                                'RESOLVED', 'REJECTED')),
  CONSTRAINT chk_invest_report_event_to_status CHECK (to_status IN ('OPEN', 'IN_REVIEW', 'NEEDS_INFO', 'RESOLVED', 'REJECTED'))
);
