-- The prompts named the agent key only as "<shared MatchMind key>", so an agent given the prompt could not call the API.
-- The real key never goes into the database: the prompts carry {{EXTERNAL_API_KEY}}, and the admin-only
-- GET /api/v1/prompts/{id}/for-agent fills it in when an admin copies a prompt for an agent.
-- Each update only runs while the old placeholder text is still there, so other admin edits are kept.

UPDATE prompt_templates
SET content = replace(content, $old$X-Api-Key: <shared MatchMind key>$old$, $new$X-Api-Key: {{EXTERNAL_API_KEY}}$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$X-Api-Key: <shared MatchMind key>$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(content,
        $old$and the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$old$,
        $new$and the headers X-Api-Key: {{EXTERNAL_API_KEY}} and X-Provider: <the same provider name that sent the prediction>):$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$and the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$old$ IN content) > 0;
