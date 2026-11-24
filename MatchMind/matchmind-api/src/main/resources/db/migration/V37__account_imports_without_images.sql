-- Account imports no longer upload screenshots: the user attaches them in the AI chat. Old rows keep their R2 key.
ALTER TABLE account_images ALTER COLUMN object_key DROP NOT NULL;
