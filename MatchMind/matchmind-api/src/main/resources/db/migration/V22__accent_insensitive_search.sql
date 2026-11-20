-- Accent-, case- and Unicode-form-insensitive text matching for search and the league filter (UX-099, UX-086).
-- unaccent is a trusted extension (PostgreSQL 13+), so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- normalize(NFC) first so a decomposed "u + combining diaeresis" folds like a precomposed "ü".
-- unaccent() itself is only STABLE (its dictionary is a lookup); naming the dictionary makes this wrapper safe to
-- declare IMMUTABLE, so it can back an expression index later if search ever needs one.
CREATE OR REPLACE FUNCTION mm_fold(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, normalize($1, NFC))) $$;
