-- Parlays: a signed-in user combines picks of different matches into one bet. The result is worked out on read from
-- the legs' current pick results, so it follows every recalculation or admin override of a leg.
CREATE TABLE parlays (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID           NOT NULL REFERENCES users (id),
    stake      NUMERIC(18, 4) CHECK (stake > 0),
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_parlays_user ON parlays (user_id, created_at DESC);

CREATE TABLE parlay_legs (
    parlay_id UUID NOT NULL REFERENCES parlays (id) ON DELETE CASCADE,
    pick_id   UUID NOT NULL REFERENCES prediction_picks (id),
    match_id  UUID NOT NULL REFERENCES matches (id),
    PRIMARY KEY (parlay_id, pick_id),
    -- One pick per match: legs of the same match are not independent.
    CONSTRAINT ux_parlay_legs_match UNIQUE (parlay_id, match_id)
);
CREATE INDEX ix_parlay_legs_pick ON parlay_legs (pick_id);
