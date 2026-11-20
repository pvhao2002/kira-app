-- UX-090: sign out one session. A token carries a jti; a revoked jti is rejected until the token would expire anyway.
CREATE TABLE revoked_tokens (
    jti        UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_revoked_tokens_expires ON revoked_tokens (expires_at);
