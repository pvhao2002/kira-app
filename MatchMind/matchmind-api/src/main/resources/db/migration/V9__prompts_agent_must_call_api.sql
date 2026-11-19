-- Agents given the prompts only printed the JSON: the prompts said "JSON only" and described delivery as the job of
-- some other agent. Make sending the request the agent's own, mandatory last step, with what to do on each error,
-- and a fixed CANNOT_CALL_API answer when the agent has no HTTP tool. Each update only runs while the old default
-- text is still there, so other admin edits are kept.

UPDATE prompt_templates
SET content = replace(replace(replace(content,
        $old$Analyse ONE football match and return ONE JSON object that is accepted unchanged by
POST /api/v1/external/predictions. Output JSON only - no prose, no markdown fences.$old$,
        $new$Analyse ONE football match, build ONE JSON object that is accepted unchanged by
POST /api/v1/external/predictions, and SEND IT TO THE API YOURSELF (see DELIVERY).
Writing the JSON in the chat is not delivery: you are done only when the API answers 201 Created or 200 OK.$new$),
        $old$DELIVERY (for the agent that sends your JSON)
Send the JSON as the request body$old$,
        $new$DELIVERY - MANDATORY, DO IT YOURSELF
As soon as the JSON is ready, send it with your HTTP / web request / code execution tool. Do not ask for
permission, do not only describe the request and do not leave the call to the user.
Send the JSON as the request body$new$),
        $old$same agent and model, otherwise their results are split across separate entries.$old$,
        $new$same agent and model, otherwise their results are split across separate entries.

AFTER SENDING
Report the outcome in at most three lines: the HTTP status, and predictionId and duplicate from the response.
- 201 Created, or 200 OK with "duplicate": true: done.
- 400: fix the JSON from "code" and "fieldErrors" in the response, then send again (at most 2 retries).
- 409 EVENT_ID_REUSED: send again with a new eventId.
- 401: the X-Api-Key is wrong. Stop and say so.
- 429 or 5xx: wait 5 seconds and send again, at most 3 times.
If you have no tool that can send an HTTP POST, reply with the single line CANNOT_CALL_API followed by a
ready-to-run curl command that contains the headers and the JSON body.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$POST /api/v1/external/predictions. Output JSON only - no prose, no markdown fences.$old$ IN content) > 0
  AND position($old$DELIVERY (for the agent that sends your JSON)$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(replace(content,
        $old$Return JSON only, accepted by POST /api/v1/external/predictions/settle
(sent to POST https://match.kira.id.vn/api/v1/external/predictions/settle with Content-Type: application/json
and the headers X-Api-Key: {{EXTERNAL_API_KEY}} and X-Provider: <the same provider name that sent the prediction>):$old$,
        $new$Build ONE JSON object accepted by POST /api/v1/external/predictions/settle and SEND IT TO THE API YOURSELF
with your HTTP / web request / code execution tool. Do not ask for permission and do not leave the call to the user.
Writing the JSON in the chat is not delivery: you are done only when the API answers 200 OK.
  POST https://match.kira.id.vn/api/v1/external/predictions/settle
  Content-Type: application/json
  X-Api-Key: {{EXTERNAL_API_KEY}}
  X-Provider: <the same provider name that sent the prediction>
Request body:$new$),
        $old$Do not invent missing results.$old$,
        $new$Do not invent missing results.

AFTER SENDING
Report the HTTP status and the backend result of each pick in at most five lines.
- 400: fix the JSON from "code" and "fieldErrors" in the response, then send again (at most 2 retries).
- 404 MATCH_NOT_FOUND: check externalMatchId and X-Provider.
- 401: the X-Api-Key is wrong. Stop and say so.
- 429 or 5xx: wait 5 seconds and send again, at most 3 times.
If you have no tool that can send an HTTP POST, reply with the single line CANNOT_CALL_API followed by a
ready-to-run curl command that contains the headers and the JSON body.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$Return JSON only, accepted by POST /api/v1/external/predictions/settle$old$ IN content) > 0
  AND position($old$X-Provider: <the same provider name that sent the prediction>):$old$ IN content) > 0;
