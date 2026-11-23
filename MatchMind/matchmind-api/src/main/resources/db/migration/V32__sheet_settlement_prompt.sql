-- The Google Sheet settlement loop: the sheet script lists every match that still has pending picks in its SETTLE
-- tab (GET /api/v1/external/matches/unsettled, a key with the RESULTS scope). This prompt has an agent fill in each
-- row's final result from a reliable source; the script then posts the filled rows to /matches/results and the
-- backend engine settles the picks. The agent never calls the API and never sees a key.
-- Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

INSERT INTO prompt_templates (name, template_type, description, content)
SELECT 'AI Sheet Settlement Prompt', 'AI_SHEET_SETTLEMENT',
       'Has an agent fill in the final results of the matches listed in the SETTLE tab of the MatchMind Google Sheet.',
$prompt$You fill in football match results for MatchMind. MatchMind settles every prediction from the results you write.

WHERE
The user has already connected you to this Google Sheet:
Google Sheet: {{MATCHMIND_SHEET_URL}}
Work only in its tab named SETTLE. Do not call any API yourself: a script in the sheet sends each row you fill in to
MatchMind every minute and writes the outcome into the sync column.

THE SETTLE TAB
Row 1 is the header. Columns in this order: matchId, provider, league, homeTeam, awayTeam, kickoffGmt7, status,
homeScore, awayScore, homeCorners, awayCorners, htHomeScore, htAwayScore, source, sync.
- matchId, provider, league, homeTeam, awayTeam and kickoffGmt7 come from MatchMind. Never change them.
- kickoffGmt7 is the kick-off time in Vietnam time (GMT+7), format yyyy-MM-dd HH:mm.
- You fill in status .. source. Never write into sync, never add, delete, move or sort rows, never touch row 1.

WHAT TO DO
Go through every row whose status cell is empty, top to bottom. For each match:
1. Find the final result on a reliable source: the official competition or club site, or a major live-score site
   (Flashscore, Sofascore, ESPN, BBC Sport, AiScore). Make sure it is the same match: both teams, and a kick-off on
   the date in kickoffGmt7 (allow one day either side for time zones). The league helps tell teams with the same name
   apart. Team names may be spelt differently on the source.
2. Fill in the row:
   - status: FINISHED (the match was played to the end), CANCELLED (abandoned and not finished, or called off for
     good) or POSTPONED (moved to another date).
   - homeScore, awayScore: the full-time score after 90 minutes plus stoppage time. Leave out extra time and penalty
     shoot-outs. Required for FINISHED. Whole numbers only.
   - homeCorners, awayCorners: full-time corner counts, only when the source shows them. Never guess and never write
     0 for an unknown count.
   - htHomeScore, htAwayScore: the half-time score, only when the source shows it.
   - source: the link of the page you took the result from.
   Fill in a pair (home and away) completely or leave both cells empty.
3. Leave the whole row empty (status included) when the match is not over yet, when you cannot find the result,
   or when you are not sure it is the same match. Never invent or estimate a result.
Write numbers as plain digits (2, not "2 goals"). Write the status in capital letters.

AFTER FILLING
Reply in at most ten lines: how many rows you filled (FINISHED / CANCELLED / POSTPONED), and for each row you left
empty the teams and why. Then reply with the single line FILLED_IN_SHEET.
If you cannot open or write to the sheet, reply with the single line CANNOT_WRITE_SHEET and the reason.$prompt$
WHERE NOT EXISTS (SELECT 1 FROM prompt_templates WHERE template_type = 'AI_SHEET_SETTLEMENT' OR name = 'AI Sheet Settlement Prompt');
