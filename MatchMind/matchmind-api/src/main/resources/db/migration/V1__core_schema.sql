-- MatchMind core schema. Enumerations are VARCHAR + CHECK so new values are an additive migration.
-- Every timestamp is TIMESTAMPTZ; odds/probabilities/lines are NUMERIC; flexible payloads are JSONB.

-- ---------------------------------------------------------------- users
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(64)  NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    role           VARCHAR(16)  NOT NULL CHECK (role IN ('ADMIN', 'VIEWER')),
    status         VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    -- Bumped on logout / password change / disable: every JWT carrying an older value is rejected.
    token_version  INTEGER      NOT NULL DEFAULT 0,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_username ON users (lower(username));

-- ---------------------------------------------------------------- providers + machine credentials
CREATE TABLE providers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(64)  NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
    name         VARCHAR(128) NOT NULL,
    description  TEXT,
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ux_providers_code UNIQUE (code)
);

-- Only the SHA-256 of the high-entropy secret is stored; the full key is shown once at creation.
CREATE TABLE provider_api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   UUID         NOT NULL REFERENCES providers (id),
    key_id        VARCHAR(32)  NOT NULL,
    secret_hash   CHAR(64)     NOT NULL,
    label         VARCHAR(128),
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_by    UUID REFERENCES users (id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    CONSTRAINT ux_provider_api_keys_key_id UNIQUE (key_id),
    CONSTRAINT ck_provider_api_keys_revoked CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL))
);
CREATE INDEX ix_provider_api_keys_provider ON provider_api_keys (provider_id);

-- ---------------------------------------------------------------- AI models
CREATE TABLE ai_models (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID         NOT NULL REFERENCES providers (id),
    name         VARCHAR(128) NOT NULL,
    version      VARCHAR(64)  NOT NULL,
    description  TEXT,
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ux_ai_models_provider_name_version UNIQUE (provider_id, name, version),
    -- Target of the composite FK that pins a prediction's model to the prediction's provider.
    CONSTRAINT ux_ai_models_id_provider UNIQUE (id, provider_id)
);

-- ---------------------------------------------------------------- matches
CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID         NOT NULL REFERENCES providers (id),
    external_match_id   VARCHAR(128) NOT NULL,
    league              VARCHAR(160) NOT NULL,
    home_team           VARCHAR(160) NOT NULL,
    away_team           VARCHAR(160) NOT NULL,
    start_time          TIMESTAMPTZ  NOT NULL,
    status              VARCHAR(16)  NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED')),
    final_home_score    SMALLINT CHECK (final_home_score >= 0),
    final_away_score    SMALLINT CHECK (final_away_score >= 0),
    final_home_corners  SMALLINT CHECK (final_home_corners >= 0),
    final_away_corners  SMALLINT CHECK (final_away_corners >= 0),
    ht_home_score       SMALLINT CHECK (ht_home_score >= 0),
    ht_away_score       SMALLINT CHECK (ht_away_score >= 0),
    ht_home_corners     SMALLINT CHECK (ht_home_corners >= 0),
    ht_away_corners     SMALLINT CHECK (ht_away_corners >= 0),
    result_updated_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ux_matches_provider_external UNIQUE (provider_id, external_match_id),
    CONSTRAINT ux_matches_id_provider UNIQUE (id, provider_id),
    -- Scores come in pairs: a missing value is NULL, never a fake zero on one side.
    CONSTRAINT ck_matches_final_pair CHECK ((final_home_score IS NULL) = (final_away_score IS NULL)),
    CONSTRAINT ck_matches_corner_pair CHECK ((final_home_corners IS NULL) = (final_away_corners IS NULL)),
    CONSTRAINT ck_matches_ht_pair CHECK ((ht_home_score IS NULL) = (ht_away_score IS NULL)),
    CONSTRAINT ck_matches_ht_corner_pair CHECK ((ht_home_corners IS NULL) = (ht_away_corners IS NULL)),
    CONSTRAINT ck_matches_finished_has_score CHECK (status <> 'FINISHED' OR final_home_score IS NOT NULL),
    CONSTRAINT ck_matches_ht_le_ft CHECK (ht_home_score IS NULL OR final_home_score IS NULL
        OR (ht_home_score <= final_home_score AND ht_away_score <= final_away_score))
);
CREATE INDEX ix_matches_start_time ON matches (start_time DESC);
CREATE INDEX ix_matches_league ON matches (league);
CREATE INDEX ix_matches_status ON matches (status);

-- ---------------------------------------------------------------- external API audit
CREATE TABLE external_api_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id        UUID REFERENCES providers (id),
    api_key_id         UUID REFERENCES provider_api_keys (id),
    request_id         VARCHAR(128) NOT NULL,
    event_id           VARCHAR(128),
    endpoint           VARCHAR(160) NOT NULL,
    http_method        VARCHAR(8)   NOT NULL,
    http_status        SMALLINT     NOT NULL,
    request_status     VARCHAR(16)  NOT NULL
        CHECK (request_status IN ('SUCCESS', 'DUPLICATE', 'REJECTED', 'FAILED')),
    processing_result  JSONB,
    error_message      TEXT,
    client_ip          VARCHAR(45),
    received_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    duration_ms        INTEGER      NOT NULL CHECK (duration_ms >= 0)
);
CREATE INDEX ix_external_api_requests_received ON external_api_requests (received_at DESC);
CREATE INDEX ix_external_api_requests_provider ON external_api_requests (provider_id, received_at DESC);
CREATE INDEX ix_external_api_requests_event ON external_api_requests (event_id);

CREATE TABLE match_result_history (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id           UUID        NOT NULL REFERENCES matches (id),
    previous_result    JSONB       NOT NULL,
    new_result         JSONB       NOT NULL,
    change_source      VARCHAR(16) NOT NULL CHECK (change_source IN ('PROVIDER', 'ADMIN')),
    source_request_id  UUID REFERENCES external_api_requests (id),
    changed_by         UUID REFERENCES users (id),
    changed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_match_result_history_match ON match_result_history (match_id, changed_at DESC);

-- ---------------------------------------------------------------- predictions (immutable snapshots)
CREATE TABLE predictions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id            UUID         NOT NULL,
    match_id               UUID         NOT NULL,
    ai_model_id            UUID         NOT NULL,
    external_event_id      VARCHAR(128) NOT NULL,
    prediction_type        VARCHAR(16)  NOT NULL CHECK (prediction_type IN ('PRE_MATCH', 'LIVE')),
    match_minute           SMALLINT CHECK (match_minute BETWEEN 0 AND 150),
    current_home_score     SMALLINT CHECK (current_home_score >= 0),
    current_away_score     SMALLINT CHECK (current_away_score >= 0),
    current_home_corners   SMALLINT CHECK (current_home_corners >= 0),
    current_away_corners   SMALLINT CHECK (current_away_corners >= 0),
    predicted_at           TIMESTAMPTZ  NOT NULL,
    payload                JSONB        NOT NULL,
    payload_hash           CHAR(64)     NOT NULL,
    metadata               JSONB,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Idempotency key for callback retries.
    CONSTRAINT ux_predictions_provider_event UNIQUE (provider_id, external_event_id),
    CONSTRAINT fk_predictions_provider FOREIGN KEY (provider_id) REFERENCES providers (id),
    -- Composite FKs: match and model must belong to the same provider as the prediction.
    CONSTRAINT fk_predictions_match FOREIGN KEY (match_id, provider_id) REFERENCES matches (id, provider_id),
    CONSTRAINT fk_predictions_model FOREIGN KEY (ai_model_id, provider_id) REFERENCES ai_models (id, provider_id),
    CONSTRAINT ck_predictions_score_pair CHECK ((current_home_score IS NULL) = (current_away_score IS NULL)),
    CONSTRAINT ck_predictions_corner_pair CHECK ((current_home_corners IS NULL) = (current_away_corners IS NULL)),
    CONSTRAINT ck_predictions_live_snapshot CHECK (prediction_type <> 'LIVE'
        OR (match_minute IS NOT NULL AND current_home_score IS NOT NULL))
);
CREATE INDEX ix_predictions_match ON predictions (match_id, predicted_at DESC);
CREATE INDEX ix_predictions_model ON predictions (ai_model_id, predicted_at DESC);
CREATE INDEX ix_predictions_predicted_at ON predictions (predicted_at DESC);

CREATE TABLE prediction_odds (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id             UUID         NOT NULL REFERENCES predictions (id),
    odds_ref                  VARCHAR(64)  NOT NULL,
    market                    VARCHAR(16)  NOT NULL CHECK (market IN ('1X2', 'AH', 'OU', 'CORNER_AH', 'CORNER_OU')),
    odds_stage                VARCHAR(16)  NOT NULL CHECK (odds_stage IN ('OPENING', 'PRE_MATCH', 'LIVE')),
    snapshot_order            INTEGER      NOT NULL DEFAULT 1 CHECK (snapshot_order >= 1),
    line                      NUMERIC(6, 2),
    line_display              VARCHAR(32),
    home_odds                 NUMERIC(8, 3) CHECK (home_odds > 1),
    away_odds                 NUMERIC(8, 3) CHECK (away_odds > 1),
    draw_odds                 NUMERIC(8, 3) CHECK (draw_odds > 1),
    over_odds                 NUMERIC(8, 3) CHECK (over_odds > 1),
    under_odds                NUMERIC(8, 3) CHECK (under_odds > 1),
    settlement_basis          VARCHAR(16)  NOT NULL CHECK (settlement_basis IN ('FULL_MATCH', 'REMAINING_MATCH')),
    home_score_at_capture     SMALLINT CHECK (home_score_at_capture >= 0),
    away_score_at_capture     SMALLINT CHECK (away_score_at_capture >= 0),
    home_corners_at_capture   SMALLINT CHECK (home_corners_at_capture >= 0),
    away_corners_at_capture   SMALLINT CHECK (away_corners_at_capture >= 0),
    captured_at               TIMESTAMPTZ,
    extra                     JSONB,
    CONSTRAINT ux_prediction_odds_ref UNIQUE (prediction_id, odds_ref),
    -- Target of the pick FK: a pick can only point at odds of the same prediction AND the same market.
    CONSTRAINT ux_prediction_odds_id_prediction_market UNIQUE (id, prediction_id, market),
    CONSTRAINT ck_prediction_odds_score_pair CHECK ((home_score_at_capture IS NULL) = (away_score_at_capture IS NULL)),
    CONSTRAINT ck_prediction_odds_corner_pair CHECK ((home_corners_at_capture IS NULL) = (away_corners_at_capture IS NULL)),
    CONSTRAINT ck_prediction_odds_line CHECK (CASE WHEN market = '1X2' THEN line IS NULL
        ELSE line IS NOT NULL AND line * 4 = trunc(line * 4) END),
    CONSTRAINT ck_prediction_odds_ou_line CHECK (market NOT IN ('OU', 'CORNER_OU') OR line >= 0),
    CONSTRAINT ck_prediction_odds_prices CHECK (CASE
        WHEN market = '1X2' THEN home_odds IS NOT NULL AND draw_odds IS NOT NULL AND away_odds IS NOT NULL
        WHEN market IN ('AH', 'CORNER_AH') THEN home_odds IS NOT NULL AND away_odds IS NOT NULL
        ELSE over_odds IS NOT NULL AND under_odds IS NOT NULL END),
    -- Remaining-match settlement is impossible without the score (or corner count) at capture time.
    CONSTRAINT ck_prediction_odds_remaining_basis CHECK (settlement_basis <> 'REMAINING_MATCH' OR CASE
        WHEN market IN ('CORNER_AH', 'CORNER_OU') THEN home_corners_at_capture IS NOT NULL
        ELSE home_score_at_capture IS NOT NULL END)
);
CREATE INDEX ix_prediction_odds_market ON prediction_odds (market, odds_stage);

CREATE TABLE prediction_stats (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id            UUID NOT NULL REFERENCES predictions (id),
    possession_home          NUMERIC(5, 2) CHECK (possession_home BETWEEN 0 AND 100),
    possession_away          NUMERIC(5, 2) CHECK (possession_away BETWEEN 0 AND 100),
    shots_home               SMALLINT CHECK (shots_home >= 0),
    shots_away               SMALLINT CHECK (shots_away >= 0),
    shots_on_target_home     SMALLINT CHECK (shots_on_target_home >= 0),
    shots_on_target_away     SMALLINT CHECK (shots_on_target_away >= 0),
    shots_off_target_home    SMALLINT CHECK (shots_off_target_home >= 0),
    shots_off_target_away    SMALLINT CHECK (shots_off_target_away >= 0),
    corners_home             SMALLINT CHECK (corners_home >= 0),
    corners_away             SMALLINT CHECK (corners_away >= 0),
    yellow_cards_home        SMALLINT CHECK (yellow_cards_home >= 0),
    yellow_cards_away        SMALLINT CHECK (yellow_cards_away >= 0),
    red_cards_home           SMALLINT CHECK (red_cards_home >= 0),
    red_cards_away           SMALLINT CHECK (red_cards_away >= 0),
    extra                    JSONB,
    CONSTRAINT ux_prediction_stats_prediction UNIQUE (prediction_id)
);

CREATE TABLE prediction_simulations (
    id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id                    UUID         NOT NULL REFERENCES predictions (id),
    method                           VARCHAR(64)  NOT NULL DEFAULT 'MONTE_CARLO',
    simulation_count                 INTEGER      NOT NULL DEFAULT 1000 CHECK (simulation_count > 0),
    random_seed                      BIGINT,
    expected_remaining_home_goals    NUMERIC(8, 4) CHECK (expected_remaining_home_goals >= 0),
    expected_remaining_away_goals    NUMERIC(8, 4) CHECK (expected_remaining_away_goals >= 0),
    expected_remaining_home_corners  NUMERIC(8, 4) CHECK (expected_remaining_home_corners >= 0),
    expected_remaining_away_corners  NUMERIC(8, 4) CHECK (expected_remaining_away_corners >= 0),
    algorithm_version                VARCHAR(64),
    parameters                       JSONB,
    probabilities                    JSONB,
    correct_score_distribution       JSONB,
    CONSTRAINT ux_prediction_simulations_prediction UNIQUE (prediction_id)
);

CREATE TABLE prediction_picks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id  UUID          NOT NULL,
    odds_id        UUID          NOT NULL,
    market         VARCHAR(16)   NOT NULL,
    pick           VARCHAR(8)    NOT NULL CHECK (pick IN ('HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER')),
    probability    NUMERIC(7, 6) NOT NULL CHECK (probability BETWEEN 0 AND 1),
    pick_rank      SMALLINT      NOT NULL CHECK (pick_rank >= 1),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT fk_prediction_picks_prediction FOREIGN KEY (prediction_id) REFERENCES predictions (id),
    CONSTRAINT fk_prediction_picks_odds FOREIGN KEY (odds_id, prediction_id, market)
        REFERENCES prediction_odds (id, prediction_id, market),
    CONSTRAINT ux_prediction_picks_rank UNIQUE (prediction_id, pick_rank),
    CONSTRAINT ck_prediction_picks_side CHECK (CASE
        WHEN market = '1X2' THEN pick IN ('HOME', 'DRAW', 'AWAY')
        WHEN market IN ('AH', 'CORNER_AH') THEN pick IN ('HOME', 'AWAY')
        ELSE pick IN ('OVER', 'UNDER') END)
);
CREATE INDEX ix_prediction_picks_odds ON prediction_picks (odds_id);
CREATE INDEX ix_prediction_picks_market ON prediction_picks (market);

CREATE TABLE prediction_correct_scores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id  UUID          NOT NULL REFERENCES predictions (id),
    score_rank     SMALLINT      NOT NULL DEFAULT 1 CHECK (score_rank >= 1),
    home_score     SMALLINT      NOT NULL CHECK (home_score >= 0),
    away_score     SMALLINT      NOT NULL CHECK (away_score >= 0),
    probability    NUMERIC(7, 6) CHECK (probability BETWEEN 0 AND 1),
    CONSTRAINT ux_prediction_correct_scores_rank UNIQUE (prediction_id, score_rank)
);

-- ---------------------------------------------------------------- settlement (append-only history)
CREATE TABLE prediction_pick_results (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id              UUID        NOT NULL REFERENCES prediction_picks (id),
    result               VARCHAR(16) NOT NULL
        CHECK (result IN ('WIN', 'LOSS', 'HALF_WIN', 'HALF_LOSS', 'PUSH', 'VOID', 'PENDING')),
    settled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    details              JSONB       NOT NULL,
    source               VARCHAR(24) NOT NULL CHECK (source IN ('AUTO', 'EXTERNAL_REQUEST', 'ADMIN_RECALCULATION', 'ADMIN_OVERRIDE')),
    calculation_version  VARCHAR(32) NOT NULL,
    is_current           BOOLEAN     NOT NULL DEFAULT TRUE,
    superseded_at        TIMESTAMPTZ,
    superseded_by        UUID REFERENCES prediction_pick_results (id),
    reason               TEXT,
    created_by           UUID REFERENCES users (id),
    CONSTRAINT ck_prediction_pick_results_current CHECK (is_current = (superseded_at IS NULL))
);
-- One authoritative row per pick; older rows stay for audit.
CREATE UNIQUE INDEX ux_prediction_pick_results_current ON prediction_pick_results (pick_id) WHERE is_current;
CREATE INDEX ix_prediction_pick_results_pick ON prediction_pick_results (pick_id, settled_at DESC);

-- ---------------------------------------------------------------- prompt templates
CREATE TABLE prompt_templates (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(128) NOT NULL,
    template_type  VARCHAR(64)  NOT NULL CHECK (template_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
    content        TEXT         NOT NULL,
    description    TEXT,
    version        INTEGER      NOT NULL DEFAULT 1 CHECK (version >= 1),
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_by     UUID REFERENCES users (id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ux_prompt_templates_name UNIQUE (name)
);
CREATE INDEX ix_prompt_templates_type ON prompt_templates (template_type);
