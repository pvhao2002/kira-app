# Kira Extension Guidelines

## Scope

Unpacked Chrome/Edge (Manifest V3) extension, loaded locally. On `https://www.aiscore.com/*` match detail pages,
`Alt+Shift+C` (`Option+Shift+C` on macOS) copies pre-match and in-play odds (Asian Handicap, Goals O/U, Corners O/U)
to the clipboard as a prediction prompt. No build step, no dependencies, no network calls, no extra permissions.

## Install

`chrome://extensions` → enable Developer mode → Load unpacked → select this folder. After editing, click reload on
the extension card and refresh the AiScore tab.

## Bookmarklet (iPhone / any browser)

`node make-bookmarklet.mjs | pbcopy` → paste into a Safari bookmark's URL. Tapping it on a match page copies once;
if the browser blocks the clipboard (common on iOS), a panel with a Copy button opens instead. Regenerate the
bookmark after editing `content.js`.

## Change Rules

- Selectors depend on AiScore's markup (`.flex.odds`, `.table.asia|bs|corner`, label rows in `.table.oddType`).
  When AiScore changes markup, update `content.js` and the fixture in `test/check.html` together.
- A market or phase whose values are missing or `-` is omitted from the prompt.

## Verification

Headless self-check (prints `PASS` or the diff):

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --allow-file-access-from-files \
      --dump-dom "file://$PWD/test/check.html" 2>/dev/null | grep -A3 '<pre id="result">'

This does not verify the hotkey or clipboard on the live site; check that manually.
