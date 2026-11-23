-- The settlement prompt was pasted into agents without its input, so the agent stopped and asked for the JSON.
-- Match detail now has "Copy settlement prompt": the prompt followed by a SETTLEMENT INPUT section with this match's
-- result, provider code and pick ids (prompt-input now includes "provider"). The prompt names that section, takes
-- X-Provider from it, and answers NEED_SETTLEMENT_INPUT in one line when it is missing.
-- replace() only changes the default text, so admin edits are kept; the version bump records a new version (V16
-- trigger). Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(replace(content,
        $old$- Usually both come as one JSON object: the settlement input that MatchMind shows for the match
  (GET /api/v1/settlements/matches/<matchId>/prompt-input). It has matchId, externalMatchId, status, finalScore,
  finalCorners, halfTimeScore and picks[] with pickId, predictionId, market, pick, line, settlementBasis, price,
  scoreAtCapture and cornersAtCapture. Use those ids as they are.$old$,
        $new$- Both come as one JSON object in the SETTLEMENT INPUT section under this prompt (MatchMind: open the match,
  click "Copy settlement prompt"). It has matchId, externalMatchId, provider, status, finalScore, finalCorners,
  halfTimeScore and picks[] with pickId, predictionId, market, pick, line, settlementBasis, price, scoreAtCapture
  and cornersAtCapture. Use those ids as they are, and send "provider" as the X-Provider header.
- No SETTLEMENT INPUT section, or no picks in it: do not work anything out, search for results or send anything.
  Reply with the single line NEED_SETTLEMENT_INPUT and stop.$new$),
        $old$  X-Provider: <the same provider name that sent the prediction>
Request body.$old$,
        $new$  X-Provider: <"provider" from the settlement input>
Request body.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position('- Usually both come as one JSON object: the settlement input that MatchMind shows' IN content) > 0;
