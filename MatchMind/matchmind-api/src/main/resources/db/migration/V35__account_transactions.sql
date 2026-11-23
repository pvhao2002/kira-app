ALTER TABLE provider_api_keys DROP CONSTRAINT ck_provider_api_keys_scopes;
ALTER TABLE provider_api_keys ADD CONSTRAINT ck_provider_api_keys_scopes
    CHECK (scopes <@ ARRAY['PREDICTIONS','SETTLE_REQUEST','RESULTS','ACCOUNT_IMPORT']::varchar[] AND cardinality(scopes)>0);

CREATE TABLE account_images (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    import_hash BYTEA,
    UNIQUE (user_id, id)
);

CREATE TABLE account_transactions (
    user_id UUID NOT NULL,
    import_id UUID NOT NULL,
    reference VARCHAR(160) NOT NULL,
    type VARCHAR(8) NOT NULL CHECK (type IN ('CREDIT','DEBIT','REWARD')),
    status VARCHAR(12) NOT NULL CHECK (status IN ('SUCCESS','CANCELLED')),
    occurred_at TIMESTAMPTZ NOT NULL,
    amount NUMERIC(20,4) NOT NULL CHECK (amount > 0),
    PRIMARY KEY (user_id,type,reference),
    FOREIGN KEY (user_id,import_id) REFERENCES account_images(user_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_account_transactions_history ON account_transactions(user_id,occurred_at DESC);
