-- Chat agents often run code in a sandbox without internet: the request fails (e.g. DNS) and a curl command is of
-- no use to the person reading the chat. Ask them for the bare request body instead, which an admin pastes into
-- MatchMind > Import prediction (POST /api/v1/predictions/import). A no-op when the text is gone.

UPDATE prompt_templates
SET content = replace(content,
        $old$If you have no tool that can send an HTTP POST, reply with the single line CANNOT_CALL_API followed by a
ready-to-run curl command that contains the headers and the JSON body.$old$,
        $new$Try the request first. If you have no tool that can send an HTTP POST, or the request cannot reach the server
(no internet in your sandbox, DNS or connection errors), do not retry. Reply with exactly these two lines:
CANNOT_CALL_API
X-Model-Name: <your model name>
followed by the request JSON body alone in one ```json code block - no curl command, no comments - so it can be
pasted into MatchMind > Import prediction.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$ready-to-run curl command that contains the headers and the JSON body.$old$ IN content) > 0;
