CREATE TABLE login_visits (
 id CHAR(36) PRIMARY KEY,
 visited_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 ip VARCHAR(45) NOT NULL,
 peer_ip VARCHAR(45) NOT NULL,
 ip_source VARCHAR(16) NOT NULL,
 visitor_id CHAR(36) NOT NULL,
 session_id CHAR(36) NOT NULL,
 navigation VARCHAR(16) NOT NULL,
 user_agent VARCHAR(512) NOT NULL,
 language VARCHAR(40) NOT NULL,
 timezone VARCHAR(80) NOT NULL,
 screen_width INT NOT NULL,
 screen_height INT NOT NULL,
 referrer VARCHAR(500) NOT NULL,
 INDEX idx_login_visit_time (visited_at),
 INDEX idx_login_visit_ip_time (ip, visited_at)
);
