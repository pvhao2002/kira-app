-- Agents read matches off screenshots: there is no provider match id or event id on them, a LIVE screen shows the
-- match minute instead of the kick-off time, and the league may be unreadable. The API now accepts predictions
-- without those fields (it finds the match by teams and kick-off, estimating the kick-off from the minute), so stop
-- asking for them and say plainly that missing details never stop the agent from sending.
-- Every replace is a no-op when its text is gone, so admin edits elsewhere are kept.

UPDATE prompt_templates
SET content = replace(replace(replace(replace(replace(replace(replace(replace(replace(content,
        $old$- Match: league, home team, away team, kick-off time (ISO-8601 UTC), status.$old$,
        $new$- Match: home team and away team (always shown); league, kick-off time (ISO-8601 UTC) and status only
  when shown. A LIVE screen shows the match minute instead of the kick-off time.$new$),
        $old$- "eventId" must be unique for every new prediction. Re-sending the same eventId with the same body is a safe
  retry; re-sending it with a different body is rejected.$old$,
        $new$- Never ask for, guess or invent ids. Leave out "eventId" and "match.externalMatchId": the server finds the
  match from the team names and the kick-off time or match minute, and resending the same JSON is a safe retry.
- Leave out "predictedAt" (the server records when it received the prediction) and "capturedAt" when unknown.
- Leave out "match.startTime" when the kick-off time is not shown (LIVE screens show the minute instead), and
  "match.league" when it cannot be read.

MISSING DATA IS NEVER A REASON NOT TO SEND
Only these are required: match.homeTeam, match.awayTeam, predictionType, at least one odds snapshot, picks that
reference it, and correctScore; for LIVE also matchMinute and currentScore. Leave out everything else you cannot
read, and send the request anyway. Do not stop to ask the user for missing details.$new$),
        $old$  "eventId": "provider-event-000123",
$old$, ''),
        $old$  "eventId": "provider-event-000124",
$old$, ''),
        $old$    "externalMatchId": "<provider match id>",
$old$, ''),
        $old$    "startTime": "2026-11-20T19:45:00Z",
$old$, ''),
        $old$  "predictedAt": "2026-11-20T20:40:00Z",
$old$, ''),
        $old$  "predictedAt": "2026-11-21T12:00:00Z",
$old$, ''),
        $old$- 409 EVENT_ID_REUSED: send again with a new eventId.
$old$, ''),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('MISSING DATA IS NEVER A REASON NOT TO SEND' IN content) = 0;
