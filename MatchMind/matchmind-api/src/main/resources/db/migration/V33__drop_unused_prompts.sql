-- Removes the MatchMind Artifact Prompt (AI_ARTIFACT), the AI Match Result Prompt (AI_MATCH_RESULT) and the AI
-- Settlement Calculation Prompt (AI_SETTLEMENT): agents deliver through the Google Sheet only, and match results now
-- come from the SETTLE tab (AI_SHEET_SETTLEMENT), which the backend engine settles on its own.
-- Their history rows go too. prompt_template_versions is append-only by trigger, so the trigger is switched off for
-- this one delete only and switched back on in the same transaction.

ALTER TABLE prompt_template_versions DISABLE TRIGGER tr_prompt_template_versions_append_only;

DELETE FROM prompt_template_versions
WHERE template_id IN (SELECT id FROM prompt_templates WHERE template_type IN ('AI_ARTIFACT', 'AI_MATCH_RESULT', 'AI_SETTLEMENT'));

DELETE FROM prompt_templates WHERE template_type IN ('AI_ARTIFACT', 'AI_MATCH_RESULT', 'AI_SETTLEMENT');

ALTER TABLE prompt_template_versions ENABLE TRIGGER tr_prompt_template_versions_append_only;
