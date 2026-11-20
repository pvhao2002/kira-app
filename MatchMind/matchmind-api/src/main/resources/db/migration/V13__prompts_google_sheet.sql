-- Some chat agents (e.g. Meta AI) cannot reach the API from their sandbox but can write to Google Sheets. Before the
-- MatchMind artifact, the two agent prompts now ask them to append the request as one row of the Google Sheet whose
-- link the admin copy fills in from MATCHMIND_SHEET_URL. The Apps Script in docs/google-sheet/MatchMind.gs sends the
-- rows. Each update only runs while the V12 text is still there, so admin edits are kept. Keep dollar-brace pairs out
-- of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content,
        $old$do not retry. Put the request in the
MatchMind artifact instead:$old$,
        $new$do not retry.
If the line below shows a docs.google.com link and you can write to Google Sheets, put the request in that sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
- Append ONE row to its MatchMind tab. Columns in this order: label, path, provider, model, modelVersion, body, status.
- label: <home team> vs <away team> - <PRE_MATCH, or LIVE and the minute>
- path: /api/v1/external/predictions
- provider, model, modelVersion: the values you send in X-Provider, X-Model-Name and X-Model-Version
- body: the request JSON body on one line, unchanged
- status: leave it empty. A script in the sheet sends the row to MatchMind and writes the result there.
Then reply with the single line QUEUED_IN_SHEET.
Otherwise, or if the append fails, put the request in the MatchMind artifact:$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$do not retry. Put the request in the
MatchMind artifact instead:$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(content,
        $old$do not retry. Put the request in the
MatchMind artifact instead:$old$,
        $new$do not retry.
If the line below shows a docs.google.com link and you can write to Google Sheets, put the request in that sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
- Append ONE row to its MatchMind tab. Columns in this order: label, path, provider, model, modelVersion, body, status.
- label: <home team> vs <away team> - settle
- path: /api/v1/external/predictions/settle
- provider: the same provider name that sent the prediction. Leave model and modelVersion empty.
- body: the request JSON body on one line, unchanged
- status: leave it empty. A script in the sheet sends the row to MatchMind and writes the result there.
Then reply with the single line QUEUED_IN_SHEET.
Otherwise, or if the append fails, put the request in the MatchMind artifact:$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$do not retry. Put the request in the
MatchMind artifact instead:$old$ IN content) > 0;
