-- Self-service profile fields (PUT /api/v1/auth/me).
ALTER TABLE users ADD COLUMN birth_date DATE NULL AFTER full_name;
ALTER TABLE users ADD COLUMN gender VARCHAR(8) NULL AFTER birth_date;
ALTER TABLE users ADD CONSTRAINT ck_users_gender CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER'));
