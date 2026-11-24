-- Anonymous visits (people who open the site while signed out), for the admin Visitors page. Kept without expiry.
CREATE TABLE visits (
    id BIGSERIAL PRIMARY KEY,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip VARCHAR(45) NOT NULL,
    country CHAR(2) NOT NULL CHECK (country ~ '^[A-Z0-9]{2}$'),
    browser VARCHAR(16) NOT NULL,
    os VARCHAR(16) NOT NULL,
    user_agent VARCHAR(512)
);
CREATE INDEX ix_visits_country_time ON visits(country, visited_at DESC);
CREATE INDEX ix_visits_ip_time ON visits(ip, visited_at DESC);
