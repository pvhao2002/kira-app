-- UX-028 / UX-098: the API now refuses capturedAt/predictedAt more than 5 minutes ahead of its clock and a PRE_MATCH
-- prediction after kick-off. The example JSON in the prediction prompt carried capture times of 2026-11-20/21 and a
-- PRE_MATCH kick-off of 2026-11-21, so the examples themselves would be rejected (PromptTemplatesIT sends them).
-- Capture times move to the past and the PRE_MATCH kick-off to a later date. Only the seeded example strings are
-- replaced, so admin edits elsewhere are kept.
UPDATE prompt_templates
SET content = replace(replace(replace(replace(content,
        $old$"capturedAt": "2026-11-20T19:30:00Z"$old$, $new$"capturedAt": "2026-11-19T19:30:00Z"$new$),
        $old$"capturedAt": "2026-11-20T20:39:30Z"$old$, $new$"capturedAt": "2026-11-19T20:39:30Z"$new$),
        $old$"capturedAt": "2026-11-21T11:45:00Z"$old$, $new$"capturedAt": "2026-11-19T11:45:00Z"$new$),
        $old$"startTime": "2026-11-21T15:00:00Z"$old$, $new$"startTime": "2028-05-20T15:00:00Z"$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND (position($old$"capturedAt": "2026-11-20T19:30:00Z"$old$ IN content) > 0
    OR position($old$"capturedAt": "2026-11-20T20:39:30Z"$old$ IN content) > 0
    OR position($old$"capturedAt": "2026-11-21T11:45:00Z"$old$ IN content) > 0
    OR position($old$"startTime": "2026-11-21T15:00:00Z"$old$ IN content) > 0);
