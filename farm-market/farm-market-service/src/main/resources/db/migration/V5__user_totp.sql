-- TOTP second factor for staff/manager/admin. totp_secret holds the base32 secret encrypted with AES-GCM
-- (base64 of iv||ciphertext||tag), hence the length. totp_last_step blocks replay of an already accepted code.
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(128) NULL;
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN totp_last_step BIGINT NULL;
