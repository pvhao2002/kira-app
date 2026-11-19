-- The default prompts named only the API path, so an agent could not tell which server to call. Add the full
-- production URL. Each update only runs while the prompt still contains the default text, so admin edits are kept.

UPDATE prompt_templates
SET content = replace(content,
        $old$Send the JSON as the request body with these HTTP headers - never put them inside the JSON:$old$,
        $new$Send the JSON as the request body (Content-Type: application/json) to
  POST https://match.kira.id.vn/api/v1/external/predictions
with these HTTP headers - never put them inside the JSON:$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$Send the JSON as the request body with these HTTP headers - never put them inside the JSON:$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(content,
        $old$(sent with the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$old$,
        $new$(sent to POST https://match.kira.id.vn/api/v1/external/predictions/settle with Content-Type: application/json
and the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$(sent with the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$old$ IN content) > 0;
