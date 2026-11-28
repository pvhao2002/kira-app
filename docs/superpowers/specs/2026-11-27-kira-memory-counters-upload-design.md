# kira-memory: love-days milestones, period countdown, faster uploads

Approved 2026-11-27. Module: `kira-memory` (service + UI). Rules: `kira-memory/AGENTS.override.md`.

## Why
- Uploading photos is slow. Root cause (code + local timing): the UI handles one file end to end — send bytes,
  wait for the server to push it to Hugging Face, wait for a status poll (first after 1 s) — before the next file
  starts, so nothing overlaps. On Hugging Face each memory costs two LFS uploads and **two git commits**
  (original and thumbnail separately); HF says repos degrade after a few thousand commits and recommends several
  files per commit. HF also caps a folder at 10k entries, and every file sits in `memories/<year>/`.
- The couple wants (a) the existing love-days count (since 14/06/2018) to celebrate milestones with effects and
  (b) a countdown to Em's next period ("ngày dâu"), logged by either account.

## Approaches (picked: first of each)
- Counters: **two cards under the gallery header** (seen on every visit, effects play on arrival) vs a separate
  "Hai đứa mình" page (more room, effects easy to miss).
- Period data: **a log of start days, cycle length averaged from recent gaps** vs one setting "last start + fixed
  cycle length" (less code, worse prediction, no history).
- Upload: **UI pipelining + one HF commit per memory** vs UI only.

## Design
**Upload**
- UI: a file's bytes go out only after the previous file's bytes reached the server (bandwidth stays one at a
  time), but storing runs alongside; at most 3 files wait on the server at once.
- Service: `BlobStore.put` takes several files; Hugging Face sends them in one LFS batch and one commit; R2 puts
  them one by one. New keys go to `memories/<yyyy>/<MM>/<uuid>` (old rows keep their keys).

**Love days (UI only)** — start date stays 14/06/2018.
- Card: total days, "N năm N tháng N ngày", and the next milestone with days left and date.
- Milestones and effects: month-day (the 14th: "Tròn N tháng") → a few hearts float up; every 100 days → petals
  fall; every 1,000 days, repdigit days (3,333, 4,444…) and anniversaries (14/06) → confetti + hearts + a card.
  Priority when two coincide: anniversary > thousand > repdigit > hundred > month.
- Plays once per day per device (localStorage, failures ignored), replay button on the card, banner closable;
  with reduced motion only the banner shows.

**Ngày dâu của Em**
- Table `cycle_start (day DATE PK, created_by, created_at)`; `GET/POST /api/cycle`, `DELETE /api/cycle/{day}`
  for both accounts (the only data change besides messages that the `love` account may make). Day must be between
  14/06/2018 and today in Vietnam; re-adding a day is a no-op; responses return the newest 12 days.
- UI prediction: average of the last ≤ 6 gaps within 21–45 days (else 28), period length 5 days. States: none,
  during (day N), before (N days left, ~date; gentle note when ≤ 3), late (N days).
- Card: "Hôm nay đến rồi" (hidden while in a period), pick another day, list of logged days with delete.
- Never on the login page; the service never logs the days.

## Non-goals
Notifications, fertile-window predictions, live SSE sync of the period card, a separate counters page, deleting
media in one HF commit.

## Left to the builder
Particle visuals, exact Vietnamese copy, component split.
