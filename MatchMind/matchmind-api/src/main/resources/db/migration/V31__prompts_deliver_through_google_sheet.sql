-- Most chat agents cannot call the MatchMind API from their sandbox, but each one is connected to the MatchMind
-- Google Sheet before it is asked for a prediction. The prediction, settlement and match result prompts now deliver
-- only by appending ONE row to the sheet's MatchMind tab; the sheet script (docs/google-sheet/MatchMind.gs) sends it
-- with the key it keeps. The prompts no longer call the API, no longer carry the API key and no longer fall back to
-- the MatchMind artifact. They also stop agents writing into the header row (row 1), which the script skips.
-- CANNOT_CALL_API stays the marker of the no-sheet fallback because Import prediction reads it.
-- Each statement replaces whole sections between fixed headings and runs only while the old delivery text is there;
-- the version bump records a new version (V16 trigger). Keep dollar-brace pairs out of this file: Flyway would read
-- them as placeholders.

UPDATE prompt_templates
SET content = regexp_replace(content, 'GOAL\n.*?\nINPUT YOU WILL RECEIVE\n', $new$GOAL
Analyse ONE football match and build ONE JSON object that MatchMind accepts unchanged as the body of
POST /api/v1/external/predictions. Do not call any API yourself: deliver the request as ONE row in the MatchMind
Google Sheet (see DELIVERY). A script in that sheet sends it to MatchMind and writes the outcome back.

DELIVERY - MANDATORY: APPEND ONE ROW TO THE GOOGLE SHEET
The user has already connected you to this Google Sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
As soon as the JSON is ready, append the row yourself. Do not ask for permission, do not only describe the row and
do not leave it to the user. Writing the JSON in the chat is not delivery.
- Use the tab named MatchMind. Columns in this order: label, path, provider, model, modelVersion, body, status.
- Row 1 is that header. Never write into row 1. If the tab is empty, first write the header into row 1.
- Add your row below the last filled row. Never change or delete other rows.
- label: <home team> vs <away team> - <PRE_MATCH, or LIVE and the minute>
- path: /api/v1/external/predictions
- provider: your agent name, e.g. meta-ai (lowercase letters, digits, '-' or '_')
- model: the model that made this prediction, e.g. gpt-5.1
- modelVersion: the model version, or leave it empty (version 1)
- body: the request JSON on ONE line, unchanged: valid JSON, no code fence, no comments
- status: leave it empty
Always use the same provider and model names for the same agent and model, otherwise their results are split
across separate entries. A new provider or model is registered on its first row.
Then reply with the single line QUEUED_IN_SHEET.
Only if you cannot write to the sheet (not connected, no permission, the append fails), reply with exactly
these two lines:
CANNOT_CALL_API
X-Model-Name: <your model name>
followed by the request JSON body alone in one ```json code block - no comments - so it can be pasted into
MatchMind > Import prediction.

INPUT YOU WILL RECEIVE
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('DELIVERY - MANDATORY, DO IT YOURSELF' IN content) > 0
  AND position('INPUT YOU WILL RECEIVE' IN content) > 0;

UPDATE prompt_templates
SET content = regexp_replace(replace(content,
        $old$and send "provider" as the X-Provider header.$old$,
        $new$and put "provider" in the provider column.$new$),
        'OUTPUT\nBuild ONE JSON object accepted by POST /api/v1/external/predictions/settle.*$', $new$OUTPUT
Build ONE JSON object for POST /api/v1/external/predictions/settle. Do not call any API yourself: deliver it as ONE
row in the MatchMind Google Sheet (see DELIVERY). A script in that sheet sends it and writes the outcome back.
Request body. Name the match with "matchId" copied from the settlement input. Never guess an id.
{
  "matchId": "<matchId from the settlement input>",
  "aiCalculations": [
    {
      "pickId": "<pick uuid>",
      "result": "HALF_WIN",
      "explanation": "OU 2.75 OVER, final 2-1 (total 3): half on 2.5 wins, half on 3.0 pushes -> HALF_WIN"
    }
  ]
}
Allowed results: WIN, LOSS, HALF_WIN, HALF_LOSS, PUSH, VOID, PENDING. Do not invent missing results.
Every pickId must be a pickId of the settlement input.

DELIVERY - MANDATORY: APPEND ONE ROW TO THE GOOGLE SHEET
The user has already connected you to this Google Sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
Append the row yourself; do not ask for permission and do not leave it to the user.
- Use the tab named MatchMind. Columns in this order: label, path, provider, model, modelVersion, body, status.
- Row 1 is that header. Never write into row 1. If the tab is empty, first write the header into row 1.
- Add your row below the last filled row. Never change or delete other rows.
- label: <home team> vs <away team> - settle
- path: /api/v1/external/predictions/settle
- provider: "provider" from the settlement input
- model and modelVersion: leave them empty
- body: the request JSON on ONE line, unchanged: valid JSON, no code fence, no comments
- status: leave it empty
Then reply with the line QUEUED_IN_SHEET, followed by your result for each pick in at most five lines.
Only if you cannot write to the sheet, reply with the line CANNOT_CALL_API followed by the request JSON body in one
```json code block.
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position('SEND IT TO THE API YOURSELF' IN content) > 0;

UPDATE prompt_templates
SET content = regexp_replace(regexp_replace(content,
        'GOAL\n.*?\nINPUT\n', $new$GOAL
Build ONE JSON object for POST /api/v1/external/matches/results. Do not call any API yourself: deliver it as ONE row
in the MatchMind Google Sheet (see DELIVERY). A script in that sheet sends it and writes the outcome back.

WHICH MATCH
Name the match with exactly ONE of these ids. Never guess or invent an id.
- "matchId": the MatchMind match id, from a settlement input or given by the user. Preferred.
- "predictionId": when the user gives it.
- "externalMatchId": only when the prediction was sent with your own externalMatchId.
If you have none of them, reply with the single line NEED_MATCH_ID and stop.

INPUT
$new$),
        'AFTER SENDING\n.*$', $new$DELIVERY - MANDATORY: APPEND ONE ROW TO THE GOOGLE SHEET
The user has already connected you to this Google Sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
Append the row yourself; do not ask for permission and do not leave it to the user.
- Use the tab named MatchMind. Columns in this order: label, path, provider, model, modelVersion, body, status.
- Row 1 is that header. Never write into row 1. If the tab is empty, first write the header into row 1.
- Add your row below the last filled row. Never change or delete other rows.
- label: <home team> vs <away team> - result
- path: /api/v1/external/matches/results
- provider: the same provider name that sent the prediction
- model and modelVersion: leave them empty
- body: the request JSON on ONE line, unchanged: valid JSON, no code fence, no comments
- status: leave it empty
Then reply with the single line QUEUED_IN_SHEET.
Only if you cannot write to the sheet, reply with the line CANNOT_CALL_API followed by the request JSON body in one
```json code block.
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_MATCH_RESULT'
  AND position('SEND IT TO THE API YOURSELF' IN content) > 0
  AND position('AFTER SENDING' IN content) > 0;
