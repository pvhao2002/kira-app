CREATE TABLE health_profiles (
 user_id BIGINT PRIMARY KEY, data JSON NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE health_weights (
 user_id BIGINT NOT NULL, measured_on DATE NOT NULL, kg DECIMAL(6,2) NOT NULL,
 PRIMARY KEY(user_id, measured_on), FOREIGN KEY(user_id) REFERENCES users(id), CHECK (kg > 0)
);
CREATE TABLE health_plans (
 id CHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, week_start DATE NOT NULL,
 status VARCHAR(20) NOT NULL, data JSON NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_health_plan_owner(user_id, week_start)
);
CREATE TABLE health_journals (
 id CHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, entry_date DATE NOT NULL,
 data JSON NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_health_journal_owner(user_id, entry_date)
);
CREATE TABLE health_devices (
 user_id BIGINT PRIMARY KEY, device_id CHAR(36) NOT NULL, generation CHAR(36) NOT NULL,
 timezone VARCHAR(80) NOT NULL, last_revision BIGINT NOT NULL DEFAULT 0, last_synced_at TIMESTAMP(6),
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE health_days (
 user_id BIGINT NOT NULL, day DATE NOT NULL, data JSON NOT NULL,
 PRIMARY KEY(user_id, day), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE health_ai_jobs (
 id CHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, status VARCHAR(20) NOT NULL,
 plan_id CHAR(36), error_code VARCHAR(80), created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX idx_health_ai_owner(user_id, created_at)
);
