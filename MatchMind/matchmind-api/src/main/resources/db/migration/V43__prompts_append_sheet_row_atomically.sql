-- Agents given the same prediction prompt at the same moment overwrote each other's row in the MatchMind tab. The
-- prompt told each one to "add your row below the last filled row": every agent read the same last row, wrote to the
-- same row number, and the last write won. Now the agent appends (Google picks the next free row, so concurrent appends
-- never share one), checks that its row is there, and appends it again if not. Re-sending an identical body is safe:
-- without an eventId the payload is the idempotency key, so MatchMind counts it once ("sent 200 (already received)").
-- Admin edits are kept (replace() only); the version bump records a new version (V16 trigger). Keep dollar-brace
-- pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content,
        $old$- Add your row below the last filled row. Never change or delete other rows.
$old$,
        $new$- Add your row with your tool's APPEND operation (Google Sheets "append rows": spreadsheets.values.append on the
  range MatchMind!A:H with insertDataOption INSERT_ROWS), so Google picks the next free row. Other agents may be
  writing to this tab at the same moment: never work out a row number yourself (such as last row + 1) and write to
  it, because two agents doing that at once land on the same row and one overwrites the other.
- Never change or delete other rows.
- Then read the MatchMind tab again and check that your row is there: your provider, model and body exactly as you
  wrote them. If it is missing or another agent's row is in its place, append the same row again (an identical row
  is counted once). Check once more after that.
- Only if your tool cannot append and can only write a given range: write your row to the first empty row below the
  last filled row, then run the same check; if your row is not there, write it again the same way.
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('- Add your row below the last filled row. Never change or delete other rows.' IN content) > 0;
