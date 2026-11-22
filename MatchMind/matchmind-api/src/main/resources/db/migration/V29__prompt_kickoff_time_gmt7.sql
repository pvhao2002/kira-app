-- The prediction prompt makes the agent work out the kick-off time (match.startTime) instead of leaving it out.
-- Screenshots come from a phone in Vietnam: times on them are GMT+7. A pre-match screen shows the kick-off date and
-- time; a live screen shows only the match minute, so the agent takes the clock in the phone status bar (when the
-- screenshot was taken) and subtracts the minutes played. The server's own estimate (receive time minus the minute)
-- stays as the fallback, but the agent may send the request long after the screenshot was taken.
-- replace() only changes the default text, so admin edits are kept; the version bump records a new version (V16
-- trigger). Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content,
        $old$- Leave out "match.startTime" when the kick-off time is not shown (LIVE screens show the minute instead), and
  "match.league" when it cannot be read.$old$,
        $new$- Leave out "match.league" when it cannot be read.

KICK-OFF TIME (match.startTime)
Times on the screenshots are Vietnam time (GMT+7). Send "match.startTime" in UTC (ISO-8601 ending in Z): the GMT+7
time minus 7 hours (a GMT+7 time before 07:00 falls on the previous day in UTC).
- PRE_MATCH: the screen shows the kick-off date and time. Convert it. If only the time is shown, use the date the
  screenshot was taken.
- LIVE: the screen shows the match minute, not the kick-off time. Work it out from the clock in the phone status bar
  (the time the screenshot was taken, GMT+7), on the day it was taken (today unless the screen shows a date):
  - 1st half (minute 1-45): kick-off = clock - minute.
  - Half time (HT): kick-off = clock - 60 minutes.
  - 2nd half (minute 46-90): kick-off = clock - minute, and add 15 minutes for the half-time break:
    kick-off = clock - (minute + 15).
  - Stoppage time (45+2, 90+4): count the minute as 45 or 90.
  - Round the result to the nearest 5 minutes.
  Example: status bar 21:32, 2nd half minute 62 -> 21:32 - 77 minutes = 20:15 GMT+7 -> "startTime" 13:15:00Z that day.
- Leave out "match.startTime" only when neither a kick-off time nor a match minute with a status-bar clock can be
  read; the server then estimates it from the time it receives the prediction.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('- Leave out "match.startTime" when the kick-off time is not shown' IN content) > 0;
