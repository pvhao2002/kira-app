-- Statements are maintained directly and no application path links individual
-- card transactions through this legacy join table.
DROP TABLE statement_transactions;

-- Financial rounding and settlement tolerance are application invariants. The
-- service does not read the seeded values from this legacy settings table.
DROP TABLE application_settings;
