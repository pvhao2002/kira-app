-- Chat agents often run in sandboxes that block outbound requests, so their call to the external API fails. They now
-- keep each request they could not send in a "MatchMind" artifact: a page in the chat from which the user sends it
-- with the browser (CORS is open on /api/v1/external/**). The page lives in the new AI_ARTIFACT prompt. The two agent
-- prompts point to it and keep CANNOT_CALL_API for agents that cannot create artifacts. Each update only runs while
-- the old default text is still there, so admin edits are kept. Keep dollar-brace pairs out of this file: Flyway
-- would read them as placeholders.

INSERT INTO prompt_templates (name, template_type, description, content) VALUES
('MatchMind Artifact Prompt', 'AI_ARTIFACT',
 'Gives an agent whose sandbox cannot reach the API the MatchMind artifact: a page in the chat that queues the requests it could not send, for the user to send from the browser.',
$prompt$MATCHMIND ARTIFACT - REQUESTS THE USER SENDS FROM THE BROWSER

Use this when a MatchMind API request cannot leave your sandbox: you have no tool that can send an HTTP request, or
the call fails (no internet, DNS or connection errors, blocked by policy). Do not retry. Keep the request in an
artifact named "MatchMind" instead: the user opens it and sends the requests to https://match.kira.id.vn from the
browser.

RULES
1. Keep ONE MatchMind artifact per conversation. Create it from the TEMPLATE below the first time a request fails,
   then update that same artifact for every later one. It must be an HTML artifact that the chat shows as a page,
   not a code block in your reply.
2. Copy the TEMPLATE exactly. Change only the QUEUE array: add one item at its end for each request you could not
   send. Never remove, reorder or change the items already in it.
3. Each item is one JSON object:
   {"label": "<what the request is, e.g. home team vs away team - LIVE 63'>",
    "path": "<the API path, e.g. /api/v1/external/predictions>",
    "headers": {<every header you would have sent, except X-Api-Key and Content-Type>},
    "body": <the request JSON body, unchanged>}
4. After updating the artifact, reply with the single line QUEUED_IN_ARTIFACT <number of items in the queue>.
5. The artifact holds the API key. Do not publish or share it.
6. If you cannot create artifacts at all, use the CANNOT_CALL_API reply that your MatchMind prompt describes.

TEMPLATE
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MatchMind</title>
<style>
  :root { color-scheme: light dark; --fg: #1f2328; --bg: #ffffff; --muted: #59636e; --line: #d1d9e0; --ok: #1a7f37; --bad: #cf222e; --accent: #0969da; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e6edf3; --bg: #0d1117; --muted: #9198a1; --line: #3d444d; --ok: #3fb950; --bad: #f85149; --accent: #4493f8; } }
  body { margin: 0; padding: 16px; font: 14px/1.45 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  h1 { margin: 0; font-size: 18px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
  input, button, textarea { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; }
  input { flex: 1 1 200px; min-width: 0; }
  button { cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #ffffff; }
  button:disabled { opacity: .5; cursor: default; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  td:last-child { white-space: nowrap; }
  textarea { box-sizing: border-box; width: 100%; height: 160px; margin-top: 12px; font: 12px/1.4 ui-monospace, monospace; }
  .muted { color: var(--muted); } .ok { color: var(--ok); } .bad { color: var(--bad); }
</style>
</head>
<body>
<h1>MatchMind</h1>
<p class="bad">This page holds your API key. Do not publish or share this artifact.</p>
<div class="bar">
  <input id="base" aria-label="API base URL">
  <input id="key" type="password" placeholder="API key" aria-label="API key" autocomplete="off">
  <button id="test" type="button">Test connection</button>
</div>
<p id="conn" class="muted"></p>
<div class="bar">
  <button id="all" type="button" class="primary">Send all</button>
  <span id="summary" class="muted"></span>
</div>
<table>
  <thead><tr><th>#</th><th>Request</th><th>Status</th><th></th></tr></thead>
  <tbody id="rows"></tbody>
</table>
<textarea id="copy" readonly hidden aria-label="Request JSON"></textarea>
<script>
// Agents: add one item at the end of QUEUE for each request you could not send. Change nothing else.
const QUEUE = [
];

const API_BASE = "https://match.kira.id.vn";
const API_KEY = "{{EXTERNAL_API_KEY}}";

const state = QUEUE.map(function () { return { sent: false, text: "Not sent", cls: "muted" }; });
let busy = false;

function el(id) { return document.getElementById(id); }
function base() { return el("base").value.trim().replace(/\/+$/, ""); }
function host() { try { return new URL(base()).host; } catch (e) { return base(); } }
function unreachable() {
  return "Cannot reach " + host() + ". If your chat app asks, allow this page to connect to it. "
    + "Otherwise use Copy JSON (for a prediction: MatchMind > Import prediction).";
}
function bodyText(item, indent) {
  // An agent may write the body as a JSON string instead of an object: send that string as it is.
  return typeof item.body === "string" ? item.body : JSON.stringify(item.body, null, indent);
}

function button(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function render() {
  const rows = el("rows");
  rows.replaceChildren();
  QUEUE.forEach(function (item, i) {
    const tr = rows.insertRow();
    tr.insertCell().textContent = String(i + 1);
    const what = tr.insertCell();
    what.textContent = item.label || "(no label)";
    const path = document.createElement("div");
    path.className = "muted";
    path.textContent = "POST " + item.path;
    what.append(path);
    const status = tr.insertCell();
    status.className = state[i].cls;
    status.textContent = state[i].text;
    tr.insertCell().append(button("Send", function () { send(i); }), " ", button("Copy JSON", function () { copy(i); }));
  });
  if (!QUEUE.length) {
    const cell = rows.insertRow().insertCell();
    cell.colSpan = 4;
    cell.className = "muted";
    cell.textContent = "No requests queued.";
  }
  const sent = state.filter(function (s) { return s.sent; }).length;
  el("summary").textContent = sent + " of " + QUEUE.length + " sent";
  el("all").disabled = busy || sent === QUEUE.length;
}

function mark(i, sent, text, cls) {
  state[i] = { sent: sent, text: text, cls: cls };
  render();
}

// Returns "ok", "failed" (this request only) or "stop" (the next requests would fail the same way).
async function send(i) {
  const item = QUEUE[i];
  const key = el("key").value.trim();
  if (!key) { mark(i, false, "Enter the API key first", "bad"); return "stop"; }
  mark(i, false, "Sending...", "muted");
  let res;
  try {
    res = await fetch(base() + item.path, {
      method: "POST",
      headers: Object.assign({}, item.headers, { "Content-Type": "application/json", "X-Api-Key": key }),
      body: bodyText(item),
    });
  } catch (e) {
    mark(i, false, unreachable(), "bad");
    return "stop";
  }
  const data = await res.json().catch(function () { return {}; });
  if (res.ok) {
    mark(i, true, res.status + (data.duplicate ? " - already received" : " - sent"), "ok");
    return "ok";
  }
  const fields = data.fieldErrors && Object.keys(data.fieldErrors).length ? " " + JSON.stringify(data.fieldErrors) : "";
  mark(i, false, res.status + " " + (data.code || res.statusText) + ": " + (data.message || "") + fields, "bad");
  return res.status === 401 ? "stop" : "failed";
}

async function sendAll() {
  busy = true;
  render();
  for (let i = 0; i < QUEUE.length; i++) {
    if (!state[i].sent && (await send(i)) === "stop") break;
  }
  busy = false;
  render();
}

async function testConnection() {
  const conn = el("conn");
  conn.className = "muted";
  conn.textContent = "Checking...";
  try {
    const res = await fetch(base() + "/api/v1/external/ping");
    const data = await res.json().catch(function () { return {}; });
    conn.className = res.ok ? "ok" : "bad";
    conn.textContent = res.ok ? "Connected. Server time " + data.serverTime : "The server answered " + res.status;
  } catch (e) {
    conn.className = "bad";
    conn.textContent = unreachable();
  }
}

async function copy(i) {
  const box = el("copy");
  // Header lines first: Import prediction reads the model from "X-Model-Name:", and the user sees the provider.
  const headers = QUEUE[i].headers || {};
  box.value = Object.keys(headers).map(function (k) { return k + ": " + headers[k]; })
    .concat(bodyText(QUEUE[i], 2)).join("\n");
  box.hidden = false;
  box.select();
  try {
    await navigator.clipboard.writeText(box.value);
  } catch (e) {
    document.execCommand("copy"); // the clipboard API is blocked here; the text stays selected for Ctrl+C
  }
}

el("base").value = API_BASE;
// A copy of the prompt made without the key still holds its placeholder: leave the field for the user.
el("key").value = /^\{\{/.test(API_KEY) ? "" : API_KEY;
el("test").onclick = testConnection;
el("all").onclick = sendAll;
render();
</script>
</body>
</html>
```$prompt$)
ON CONFLICT (name) DO NOTHING;

UPDATE prompt_templates
SET content = replace(content,
        $old$(no internet in your sandbox, DNS or connection errors), do not retry. Reply with exactly these two lines:$old$,
        $new$(no internet in your sandbox, DNS or connection errors, blocked by policy), do not retry. Put the request in the
MatchMind artifact instead:
- If this conversation already has the MatchMind artifact, add the request to the end of its QUEUE.
- Otherwise create the artifact from the "MatchMind Artifact Prompt". If that prompt is not in this conversation,
  ask the user to paste it, then create the artifact.
The queue item for this request:
{"label": "<home team> vs <away team> - <PRE_MATCH, or LIVE and the minute>",
 "path": "/api/v1/external/predictions",
 "headers": {"X-Provider": "<your provider name>", "X-Model-Name": "<your model name>",
             "X-Model-Version": "<your model version>"},
 "body": <the request JSON body>}
Then reply with the single line QUEUED_IN_ARTIFACT <number of items in the queue>.
Only if you cannot create artifacts, reply with exactly these two lines:$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position($old$(no internet in your sandbox, DNS or connection errors), do not retry. Reply with exactly these two lines:$old$ IN content) > 0;

UPDATE prompt_templates
SET content = replace(content,
        $old$If you have no tool that can send an HTTP POST, reply with the single line CANNOT_CALL_API followed by a
ready-to-run curl command that contains the headers and the JSON body.$old$,
        $new$Try the request first. If you have no tool that can send an HTTP POST, or the request cannot reach the server
(no internet in your sandbox, DNS or connection errors, blocked by policy), do not retry. Put the request in the
MatchMind artifact instead:
- If this conversation already has the MatchMind artifact, add the request to the end of its QUEUE.
- Otherwise create the artifact from the "MatchMind Artifact Prompt". If that prompt is not in this conversation,
  ask the user to paste it, then create the artifact.
The queue item for this request:
{"label": "<home team> vs <away team> - settle",
 "path": "/api/v1/external/predictions/settle",
 "headers": {"X-Provider": "<the same provider name that sent the prediction>"},
 "body": <the request JSON body>}
Then reply with the single line QUEUED_IN_ARTIFACT <number of items in the queue>.
Only if you cannot create artifacts, reply with the single line CANNOT_CALL_API followed by a ready-to-run curl
command that contains the headers and the JSON body.$new$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_SETTLEMENT'
  AND position($old$If you have no tool that can send an HTTP POST, reply with the single line CANNOT_CALL_API followed by a
ready-to-run curl command that contains the headers and the JSON body.$old$ IN content) > 0;
