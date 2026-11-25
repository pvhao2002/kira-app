-- Raise the hit rate of the picks. From the settled picks on prod (2026-11-25): rank 1 claimed 65% and won 57%, rank 2
-- claimed 56% and won 39%; picks priced above 1.90 won 23%; picks the agent rated far above the market won 20%.
-- Backtest on those picks: rank 1 priced 1.66-1.90 won 70% (23), above 1.90 won 17% (12); rank 2 at p >= 0.55 won 50%.
-- 1) Only picks priced 1.66-1.90; rank 2 only at p >= 0.60; re-check picks rated far above the market.
-- 2) A TRACK RECORD section the server fills in on every copy ({{TRACK_RECORD}}, PromptController.forAgent) with the
--    latest settled results, so the agent corrects itself as results come in.
-- Admin edits are kept (replace() only); the version bump records a new version (V16 trigger). Keep dollar-brace
-- pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(replace(content,
        $old$7. Pick the TWO selections with the highest estimated winning probability (rank 1 and rank 2).
$old$,
        $new$7. Pick up to TWO selections (rank 1 and rank 2) as SELECTION RULES below says.
$new$),
        $old$QUY TẮC RIÊNG CHO LIVE
$old$,
        $new$SELECTION RULES - TO WIN MORE OFTEN (apply to LIVE and PRE_MATCH; they win over the ranking steps there)
a. Price window. Only pick selections priced above 1.65 and at most 1.90 (the selection's own price on the
   snapshot you pick from). Never pick a selection priced above 1.90: in our record those won about 1 in 6, against
   7 in 10 inside the window. If no candidate is inside the window, do not append a row: reply with the single line
   NO_PICK_PRICE_OUT_OF_RANGE.
b. Rank 1 is the candidate inside the window with the highest simulated probability.
c. Rank 2 only when it is also inside the window and its probability is at least 0.60. Otherwise send rank 1 alone
   and say so in metadata.notes. Our rank 2 picks won far less often than rank 1.
d. Market check. Take the bookmaker's probability of the selection from the same snapshot, margin removed (q). If
   your probability p is more than 0.10 above q, re-check the line, the side, the settlement basis and the score at
   capture before you keep the pick. Most losing picks were ones rated far above the market at long prices.
e. Be honest. Do not round probabilities up. TRACK RECORD says how far off your past probabilities were: lower
   yours by that much.
f. Use TRACK RECORD. Skip a market/side listed under AVOID unless its probability is at least 0.65. When two
   candidates are within 0.03 of each other, take the one listed under FAVOUR.

TRACK RECORD (MatchMind's settled picks; MatchMind fills this in each time the prompt is copied)
{{TRACK_RECORD}}

QUY TẮC RIÊNG CHO LIVE
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('7. Pick the TWO selections with the highest estimated winning probability (rank 1 and rank 2).' IN content) > 0
  AND position('QUY TẮC RIÊNG CHO LIVE' IN content) > 0
  AND position('{{TRACK_RECORD}}' IN content) = 0;
