-- Account activity: every sign-in attempt and every change (non-GET request) a signed-in user makes.
-- Kept without expiry. No FK: the history outlives the user row. username is NULL for a sign-in with an unknown
-- username (what was typed may be a password); the user is then unknown too.
CREATE TABLE user_activity (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_id     UUID,
    username    VARCHAR(64),
    method      VARCHAR(8)   NOT NULL,
    path        VARCHAR(255) NOT NULL,
    http_status SMALLINT     NOT NULL,
    client_ip   VARCHAR(45),
    user_agent  VARCHAR(512)
);
CREATE INDEX ix_user_activity_at ON user_activity (at DESC);
CREATE INDEX ix_user_activity_user ON user_activity (user_id, at DESC);
