-- Agents appended the stage to the league ("UEFA Champions League - Group 4 - Round 5"), so one competition showed up
-- as several leagues. 1) The prediction prompt asks for the competition name only. 2) Stored matches drop the suffix,
-- which merges those leagues. Same rule as TextRules.league, which now also cleans every incoming name. Admin edits
-- of the prompt are kept (replace() only), the version bump records a new version (V16 trigger). Keep dollar-brace
-- pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(content,
        $old$- Leave out "match.league" when it cannot be read.
$old$,
        $new$- Leave out "match.league" when it cannot be read.
- "match.league" is the competition name only: leave out the stage, group, round, region or matchday
  ("UEFA Champions League", not "UEFA Champions League - Group 4 - Round 5").
$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('- Leave out "match.league" when it cannot be read.' IN content) > 0
  AND position('"match.league" is the competition name only' IN content) = 0;

UPDATE matches
SET league = regexp_replace(league,
        ' - (?:round|group|matchday|match day|week|leg|stage|phase|league|regular season|play-?offs?|qualif\w*|preliminary|knockout|quarter\S*|semi\S*|finals?|(?:[a-z]+ )?region)\y.*$',
        '', 'i')
WHERE league ~* ' - (?:round|group|matchday|match day|week|leg|stage|phase|league|regular season|play-?offs?|qualif\w*|preliminary|knockout|quarter\S*|semi\S*|finals?|(?:[a-z]+ )?region)\y';
