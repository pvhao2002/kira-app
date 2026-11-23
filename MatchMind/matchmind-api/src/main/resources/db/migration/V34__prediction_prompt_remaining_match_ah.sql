-- Step 6 of the prediction prompt said "AH: HOME / AWAY with the handicap line applied to the HOME team" without
-- naming the settlement basis, so an agent could apply a live AH line to the full-match score (counting from 0-0).
-- Only the Vietnamese step 4 said to subtract scoreAtCapture first. Say it in step 6 too, with an example.
-- replace() only changes the default text, so admin edits are kept; the version bump records a new version (V16
-- trigger). Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content,
        $old$   - CORNER_AH / CORNER_OU: same rules on corners - ONLY if corner odds were supplied.
$old$,
        $new$   - CORNER_AH / CORNER_OU: same rules on corners - ONLY if corner odds were supplied.
   - Settlement basis of the odds snapshot decides which score the line is applied to:
     FULL_MATCH: the simulated final score as it is.
     REMAINING_MATCH (live AH is usually quoted this way): first subtract that snapshot's scoreAtCapture
     (cornersAtCapture for corner markets) from the simulated final score, team by team, then apply the line.
     Never apply a REMAINING_MATCH line to the full-match score counted from 0-0.
     Example: AH HOME -0.5 captured at 1-0, simulated final 2-1: remaining part 1-1, so HOME -0.5 loses.
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('   - CORNER_AH / CORNER_OU: same rules on corners - ONLY if corner odds were supplied.' IN content) > 0
  AND position('Settlement basis of the odds snapshot decides which score' IN content) = 0;
