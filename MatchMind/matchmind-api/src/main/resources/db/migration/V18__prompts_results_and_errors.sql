-- Prompt fixes for the result and settlement flow:
-- * Agents that leave out externalMatchId get a server id (auto-...) they cannot know. The results and settle APIs
--   now also take matchId or predictionId, so the prediction prompt asks agents to report those ids, and a new
--   "AI Match Result Prompt" tells an agent how to send a match result.
-- * The prediction prompt explains 409 EVENT_ID_REUSED and MATCH_ALREADY_FINAL.
-- * The settlement prompt names its input (GET /settlements/matches/{id}/prompt-input), 422 PICK_NOT_IN_MATCH and
--   FINAL_BELOW_CAPTURE_SCORE.
-- * An end-to-end test marker left at the end of a template is removed.
-- Each replace() only changes text that is still the default, so admin edits are kept. Every changed template gets a
-- new version (kept in prompt_template_versions). Keep dollar-brace pairs out of this file: Flyway would read them as
-- placeholders.

UPDATE prompt_templates
SET content = regexp_replace(content, '\s*<!-- e2e [^>]*-->\s*$', ''),
    version = version + 1,
    updated_at = now()
WHERE content ~ '<!-- e2e [^>]*-->\s*$';

UPDATE prompt_templates
SET content = replace(replace(content,
        $old$Report the outcome in at most three lines: the HTTP status, and predictionId and duplicate from the response.$old$,
        $new$Report the outcome in at most three lines: the HTTP status, and predictionId, matchId, externalMatchId and
duplicate from the response. Keep the predictionId: the match result is sent later with it (AI Match Result Prompt).$new$),
        $old$- 401: the X-Api-Key is wrong. Stop and say so.
- 429 or 5xx:$old$,
        $new$- 401: the X-Api-Key is wrong. Stop and say so.
- 409 EVENT_ID_REUSED: MatchMind already stored a different prediction under the same event id. Do not send it
  again; report the code and message.
- 409 MATCH_ALREADY_FINAL: the match already has a final result, so it takes no more predictions. Do not send it
  again; report it.
- 429 or 5xx:$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('and predictionId and duplicate from the response.' IN content) > 0;

UPDATE prompt_templates
SET content = replace(replace(replace(replace(content,
        $old$  when available.

RULES$old$,
        $new$  when available.
- Usually both come as one JSON object: the settlement input that MatchMind shows for the match
  (GET /api/v1/settlements/matches/<matchId>/prompt-input). It has matchId, externalMatchId, status, finalScore,
  finalCorners, halfTimeScore and picks[] with pickId, predictionId, market, pick, line, settlementBasis, price,
  scoreAtCapture and cornersAtCapture. Use those ids as they are.

RULES$new$),
        $old$     on the goals scored after capture.
4. 1X2:$old$,
        $new$     on the goals scored after capture.
     If the final score is lower than the score at capture, the result is wrong: the backend keeps the pick
     PENDING with the reason FINAL_BELOW_CAPTURE_SCORE. Report PENDING and say why; do not guess.
4. 1X2:$new$),
        $old$Request body:
{
  "externalMatchId": "<provider match id>",$old$,
        $new$Request body. Name the match with exactly ONE of "matchId", "predictionId" or "externalMatchId", copied from
the settlement input. Never guess an id.
{
  "matchId": "<matchId from the settlement input>",$new$),
        $old$- 404 MATCH_NOT_FOUND: check externalMatchId and X-Provider.
$old$,
        $new$- 404 MATCH_NOT_FOUND: check the match id and X-Provider (the provider that sent the prediction).
- 422 PICK_NOT_IN_MATCH: a pickId is not a pick of this match. Fix it from the settlement input, then send again
  once.
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position('- 404 MATCH_NOT_FOUND: check externalMatchId and X-Provider.' IN content) > 0;

INSERT INTO prompt_templates (name, template_type, description, content)
SELECT 'AI Match Result Prompt', 'AI_MATCH_RESULT',
       'Tells an agent how to send the actual result of a match (POST /api/v1/external/matches/results), which settles its picks.',
$prompt$You report the actual result of ONE football match to MatchMind. MatchMind then settles the predictions on it.

GOAL
Build ONE JSON object accepted by POST /api/v1/external/matches/results and SEND IT TO THE API YOURSELF with your
HTTP / web request / code execution tool. Do not ask for permission and do not leave the call to the user.
Writing the JSON in the chat is not delivery: you are done only when the API answers 200 OK.
  POST {{API_BASE_URL}}/api/v1/external/matches/results
  Content-Type: application/json
  X-Api-Key: {{EXTERNAL_API_KEY}}
  X-Provider: <the same provider name that sent the prediction>

WHICH MATCH
Name the match with exactly ONE of these ids. Never guess or invent an id.
- "predictionId": from the reply to a prediction you sent for this match, or given by the user. Preferred.
- "matchId": the MatchMind match id, when the user gives it.
- "externalMatchId": only when the prediction was sent with your own externalMatchId.
If you have none of them, ask the user for the predictionId.

INPUT
The result from a reliable source: the official competition site, a live-score page or a screenshot the user
shares. Send only what the source shows. Never invent a score.

RULES
1. "status": FINISHED (the match is over), CANCELLED (abandoned or void), POSTPONED, LIVE or SCHEDULED.
2. FINISHED needs "finalScore". "finalScore" and "finalCorners" are only allowed with FINISHED.
3. "finalCorners", "halfTimeScore" and "halfTimeCorners" are optional. Leave out what the source does not show and
   never send 0 for unknown corners. Half-time values cannot exceed the final ones.
4. "resultAt": when the match ended, or when you read the result, as an ISO-8601 UTC time such as
   2026-11-20T21:40:00Z. It must not be later than now: more than 5 minutes in the future is rejected.
5. Do not send FINISHED for a match that has not kicked off yet.

Request body (example values):
{
  "predictionId": "<predictionId of the prediction for this match>",
  "status": "FINISHED",
  "finalScore": { "home": 2, "away": 1 },
  "finalCorners": { "home": 7, "away": 4 },
  "halfTimeScore": { "home": 1, "away": 0 },
  "resultAt": "2026-11-20T21:40:00Z"
}

AFTER SENDING
Report in at most three lines: the HTTP status, "changed", the match status and the settlement counts (settled,
pending, needsReview) from the response.
- 200 with "changed": false: the same result was already stored. Done.
- 400: fix the JSON from "code" and "fieldErrors" in the response, then send again (at most 2 retries).
- 401: the X-Api-Key is wrong. Stop and say so.
- 404 MATCH_NOT_FOUND: the id is not a match of this X-Provider. Check both; do not try other ids.
- 409 STALE_RESULT: a result with a later resultAt is already stored. Do not send it again; report it.
- 409 MATCH_NOT_STARTED: the match has not kicked off yet. Do not send it again; report it.
- 429 or 5xx: wait 5 seconds and send again, at most 3 times.
Try the request first. If you have no tool that can send an HTTP POST, or the request cannot reach the server
(no internet in your sandbox, DNS or connection errors, blocked by policy), do not retry. Put the request in the
MatchMind artifact:
- If this conversation already has the MatchMind artifact, add the request to the end of its QUEUE.
- Otherwise create the artifact from the "MatchMind Artifact Prompt". If that prompt is not in this conversation,
  ask the user to paste it, then create the artifact.
The queue item for this request:
{"label": "<home team> vs <away team> - result",
 "path": "/api/v1/external/matches/results",
 "headers": {"X-Provider": "<the same provider name that sent the prediction>"},
 "body": <the request JSON body>}
Then reply with the single line QUEUED_IN_ARTIFACT <number of items in the queue>.
Only if you cannot create artifacts, reply with the single line CANNOT_CALL_API followed by the request JSON body.$prompt$
WHERE NOT EXISTS (SELECT 1 FROM prompt_templates WHERE template_type = 'AI_MATCH_RESULT' OR name = 'AI Match Result Prompt');
