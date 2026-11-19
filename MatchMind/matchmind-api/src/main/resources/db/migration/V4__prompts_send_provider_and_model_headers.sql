-- Agents now authenticate with one shared key and name their provider and model in headers (X-Provider,
-- X-Model-Name); providers and models are created on first use. Update the default prompts to say so.
-- Each update only runs while the prompt still contains the default text, so admin edits are never overwritten.

UPDATE prompt_templates
SET content = replace(
        replace(content,
            $old$POST /api/v1/external/predictions. Output JSON only - no prose, no markdown fences.$old$,
            $new$POST /api/v1/external/predictions. Output JSON only - no prose, no markdown fences.

DELIVERY (for the agent that sends your JSON)
Send the JSON as the request body with these HTTP headers - never put them inside the JSON:
  X-Api-Key: <shared MatchMind key>
  X-Provider: <your agent name, e.g. openclaw> (lowercase letters, digits, '-' or '_')
  X-Model-Name: <the model that made this prediction, e.g. gpt-5.1>
  X-Model-Version: <model version; optional, default 1>
A new provider or model is registered automatically on its first call. Always send the same names for the
same agent and model, otherwise their results are split across separate entries.$new$),
        $old$  "model": { "name": "<your model name>", "version": "<your model version>" },
$old$, ''),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$  "model": { "name": "<your model name>", "version": "<your model version>" },$old$ IN content) > 0
  AND position($old$POST /api/v1/external/predictions. Output JSON only - no prose, no markdown fences.$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(content,
        $old$Return JSON only, accepted by POST /api/v1/external/predictions/settle:$old$,
        $new$Return JSON only, accepted by POST /api/v1/external/predictions/settle
(sent with the headers X-Api-Key and X-Provider - the same provider name that sent the prediction):$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$Return JSON only, accepted by POST /api/v1/external/predictions/settle:$old$ IN content) > 0;
