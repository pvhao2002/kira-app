CREATE TABLE english_rewrites (
 id CHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, kind VARCHAR(20) NOT NULL, category VARCHAR(20),
 question VARCHAR(500), notes TEXT NOT NULL, title VARCHAR(80) NOT NULL, result_json JSON NOT NULL,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX idx_english_rewrites_owner(user_id, created_at)
);
