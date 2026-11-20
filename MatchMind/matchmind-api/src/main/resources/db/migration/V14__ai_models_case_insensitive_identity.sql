-- UX-108 / UX-118 / UX-017: a model is identified like a provider. The name is compared case-insensitively and the
-- version ignores trailing ".0" groups ("1" = "1.0"). The first spelling stored stays the display name.
-- AiModelRepository.findSameModel uses the same expression. Existing databases may already hold such near-duplicate
-- models; they are left alone (no merge here) and the index is then skipped, so the migration never fails on them.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ai_models
        GROUP BY provider_id, lower(name), regexp_replace(lower(version), '(\.0+)+$', '')
        HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX ux_ai_models_provider_identity
            ON ai_models (provider_id, lower(name), regexp_replace(lower(version), '(\.0+)+$', ''));
    ELSE
        RAISE NOTICE 'ai_models has case/version near-duplicates; ux_ai_models_provider_identity not created';
    END IF;
END $$;
