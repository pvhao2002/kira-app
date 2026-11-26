-- Session cookies carry the version they were issued under (JWT claim "sv"; none means 0). Changing or resetting a
-- password moves the account to the next version, which ends every session issued before it.
ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0;
