-- UX-059: an admin can force a password change at the next login.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- UX-044: who changed which account, from what to what, when. No FK: history outlives the user row.
CREATE TABLE user_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        UUID,
    actor_username  VARCHAR(64),
    target_id       UUID        NOT NULL,
    target_username VARCHAR(64) NOT NULL,
    action          VARCHAR(32) NOT NULL,
    old_value       VARCHAR(64),
    new_value       VARCHAR(64),
    client_ip       VARCHAR(45)
);
CREATE INDEX ix_user_audit_at ON user_audit (at DESC);
CREATE INDEX ix_user_audit_target ON user_audit (target_id, at DESC);
