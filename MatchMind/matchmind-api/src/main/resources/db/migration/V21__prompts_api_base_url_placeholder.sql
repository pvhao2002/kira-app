-- The prompts named the production host. A prompt copied from a local or staging stack then sent that stack's key and
-- data to production. They now name the API through {{API_BASE_URL}}, which the copy for agents fills in from
-- PUBLIC_BASE_URL (or the origin of the request). Only templates that still contain the old host change, so other
-- admin edits are kept. Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content, 'https://match.kira.id.vn', '{{API_BASE_URL}}'),
    version = version + 1,
    updated_at = now()
WHERE position('https://match.kira.id.vn' IN content) > 0;
