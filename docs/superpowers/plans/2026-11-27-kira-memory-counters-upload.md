# kira-memory counters + faster uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uploads overlap sending with storing and use one Hugging Face commit per memory; the gallery gets a love-days card with milestone effects and a "Ngày dâu của Em" period countdown.

**Architecture:** Service: `BlobStore.put` takes several files (HF: one LFS batch + one commit), a new `cycle` capability (table + 3 endpoints for both accounts). UI: pure logic in `core/since.ts` / `core/cycle.ts` (unit-tested), thin standalone components for the two cards and the effect overlay, and an `inTurn` scheduler for uploads.

**Tech Stack:** Java 25, Spring Boot 3.5, JdbcClient, Flyway, MySQL 8, Testcontainers; Angular 22 standalone + signals (zoneless), vitest via `ng test`.

**Spec:** `docs/superpowers/specs/2026-11-27-kira-memory-counters-upload-design.md`

## Global Constraints
- Service verify: `cd kira-memory/kira-memory-service && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q verify` (Docker running).
- UI verify: `cd kira-memory/kira-memory-ui && npx ng test --watch=false && npx ng build`.
- Contract changes land in the service, `kira-memory-ui/src/app/core/api.ts` and `kira-memory/docs/api.md` together.
- Schema: only a new `V3__cycle.sql` (`V2__session_version.sql` exists); never edit applied migrations.
- Never log tokens, provider response bodies, or period days.
- "Today" is the Vietnam date (`Asia/Ho_Chi_Minh`) in UI and service. Start date 14/06/2018 (`START` in `since.ts`, `SettingsController.SINCE`).
- Vietnamese copy, theme tokens from `src/styles.css`, reduced motion respected. No new dependencies.
- No commits or pushes: the user authorizes them after review (replaces the usual per-task commit step).

## Review Focus
- A file that fails to send (4xx, unsupported) must not stop later files, and earlier files keep storing → `inTurn` test "skips storing for items that failed to send" (Task 2).
- A storing failure or a bug in a callback must never leave the dialog stuck in "Đang tải lên…" → `start()` resets `running` in `finally` (Task 2; checked in the Task 6 runtime run with a failing upload).
- Logging a period day in the future, before 14/06/2018, or as garbage → 400 `INVALID_DAY`, not a 500 (Task 3 IT).
- Period starts arrive unsorted or duplicated (two accounts, double taps) → prediction sorts and dedupes (Task 4 test).
- On a milestone day the "next" milestone is strictly later, and coinciding milestones pick the highest tier (Task 5 tests).

---

### Task 1: One Hugging Face commit per memory, month folders

**Files:**
- Modify: `kira-memory/kira-memory-service/src/main/java/com/kira/memory/storage/BlobStore.java`
- Modify: `kira-memory/kira-memory-service/src/main/java/com/kira/memory/storage/HuggingFaceBlobStore.java:58-86,152-158`
- Modify: `kira-memory/kira-memory-service/src/main/java/com/kira/memory/storage/R2BlobStore.java:60-72`
- Modify: `kira-memory/kira-memory-service/src/main/java/com/kira/memory/media/MediaService.java:100-107`
- Test: `kira-memory/kira-memory-service/src/test/java/com/kira/memory/it/HubStub.java`, `.../it/MemoryFlowIT.java`

**Interfaces:**
- Produces: `record BlobStore.Upload(String key, Path file, String contentType)`; `void BlobStore.put(List<Upload> files)` replaces `put(String, Path, String)`.

- [ ] **Step 1: Make the stub count commits and answer multi-object batches.** `HubStub`: `final AtomicInteger commits`, incremented on every successful commit; the batch handler loops over every entry of `objects` (same per-object logic as today). `MemoryFlowIT.clean()`: `HUB.files.clear(); HUB.commits.set(0);`.
- [ ] **Step 2: Write the failing assertions** in `uploadToHuggingFaceAndServeCacheableBytes`, right after the existing `assertEquals(2, HUB.files.size(), ...)`:
```java
assertEquals(1, HUB.commits.get(), "original and thumbnail go up in one commit");
assertTrue(HUB.files.keySet().stream().allMatch(k -> k.matches("memories/\\d{4}/\\d{2}/[0-9a-f-]{36}(_thumb)?\\.jpg")),
    HUB.files.keySet().toString());
```
  and in `largeHuggingFaceUploadUsesMultipart`: `assertEquals(1, HUB.commits.get());`.
- [ ] **Step 3: Run** `mvn -q verify -Dit.test=MemoryFlowIT` (JDK 25). Expected: FAIL (2 commits, `memories/<yyyy>/<uuid>` keys).
- [ ] **Step 4: Implement** (HEAD `0801d08` already changed `send()` to return the raw body: parse only the batch
  answer, verify answers plain "OK"). HF `put(List<Upload>)`: sha256 + size per file, ONE batch request with all objects, then for each returned object match the file by `oid` (no `upload` action = already on the Hub, skip), upload basic/multipart + verify as today, then ONE `commit("Add " + keys joined by ", ", operations)`; `commit(String summary, List<Map<String, Object>> operations)` writes the header line then one line per operation (`delete` passes a single-element list). R2: `put(List<Upload>)` loops a private `putOne(key, file, contentType)` (today's body). `MediaService.store`: base `"memories/%d/%02d/%s".formatted(year, month, UUID)` from `takenAt` in UTC, one `store.put(List.of(original, thumb))`; error handling unchanged.
- [ ] **Step 5: Run** the IT again. Expected: PASS, all existing tests too.

### Task 2: Send the next file while earlier ones are stored

**Files:**
- Modify: `kira-memory/kira-memory-ui/src/app/features/gallery/chunked-upload.ts`
- Modify: `kira-memory/kira-memory-ui/src/app/features/gallery/upload-dialog.ts:144-170`
- Test: `kira-memory/kira-memory-ui/src/app/features/gallery/chunked-upload.spec.ts`

**Interfaces:**
- Produces (replacing `chunkedUpload` and `Progress`):
  - `MAX_STORING = 3`
  - `sendUpload(api: Api, file: File, details: FormData, onProgress: (percent: number) => void): Promise<UploadStatus>` — create, chunks with today's retries, complete; resolves with the completed session.
  - `awaitStored(api: Api, session: UploadStatus): Promise<Media>` — today's polling loop.
  - `inTurn<T>(items: readonly T[], send: (item: T) => Promise<boolean>, stored: (item: T) => Promise<void>): Promise<void>` — sends one at a time; `send` false = skip storing; waits while MAX_STORING stores are pending; resolves when all are stored.

- [ ] **Step 1: Write the failing tests** in `chunked-upload.spec.ts` (deferred promises, `await Promise.resolve()` flushes):
  - `'sends the next file while earlier ones are stored, at most 3 at once'`: items `[1,2,3,4,5]`, every `stored` left pending → log is exactly `send 1, send 2, send 3` (store 1 started before send 2); resolving store 1 → `send 4` runs; resolving stores 2–5 → `send 5` runs and `inTurn` resolves.
  - `'skips storing for items that failed to send'`: `send` returns false for 2 → `stored` never called with 2, items 3+ still sent.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL (`inTurn` not exported).
- [ ] **Step 3: Implement** the three functions (split of today's `chunkedUpload`) and rewrite `UploadDialog.start()`: candidates are picks in `waiting`/`failed` with size ≤ `MAX_BYTES`; `send` = mark uploading, build the form (today's code moved to `private details(p): Promise<FormData>`), `sendUpload`, keep the session in a local `Map<Pick, UploadStatus>`, mark `storing`; `stored` = `awaitStored` → `done`, errors → `failed` with `errorMessage(err, 'Tải lên thất bại')`; `running.set(false)` in `finally`. Update the class comment (bandwidth stays one file at a time; storing overlaps).
- [ ] **Step 4: Run** the UI tests. Expected: PASS.

### Task 3: Period days API (`/api/cycle`)

**Files:**
- Create: `kira-memory/kira-memory-service/src/main/resources/db/migration/V3__cycle.sql`
- Create: `kira-memory/kira-memory-service/src/main/java/com/kira/memory/cycle/CycleController.java`
- Modify: `kira-memory/docs/api.md` (Both accounts table), `kira-memory/AGENTS.override.md` (rule: data changes except messages **and period days** are admin-only)
- Test: `kira-memory/kira-memory-service/src/test/java/com/kira/memory/it/MemoryFlowIT.java`

**Interfaces:**
- Produces: `GET /api/cycle` → `{starts: string[]}` (ISO days, newest first, at most 12); `POST /api/cycle {day}` → same body; `DELETE /api/cycle/{day}` → same body. 400 `INVALID_DAY` "Ngày không hợp lệ".
- Table `cycle_start (day DATE PRIMARY KEY, created_by BIGINT NOT NULL FK users, created_at DATETIME(3) NOT NULL)`.

- [ ] **Step 1: Write the failing IT** `bothAccountsLogPeriodDays` (`clean()` also runs `DELETE FROM cycle_start`): with `today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))` — `love` posts `today-30`, `admin` posts `today` → starts `[today, today-30]`; posting `today` again keeps 2; `today+1`, `"2018-06-13"`, `"hôm qua"` → code `INVALID_DAY`; `DELETE /api/cycle/{today}` by `love` → `[today-30]`; GET without cookie → 401.
- [ ] **Step 2: Run** the IT. Expected: FAIL (404 / no table).
- [ ] **Step 3: Implement.** Migration as above (comment: who writes it and why). Controller in package `cycle`: `day` taken as String, parsed with `LocalDate.parse`, range `SettingsController.SINCE`..`LocalDate.now(VIETNAM)` else `INVALID_DAY`; insert `... ON DUPLICATE KEY UPDATE day = day` with `CurrentUser.id()` and `Utc.now()`; delete is idempotent; every response = newest 12. No logging.
- [ ] **Step 4: Run** the IT. Expected: PASS. Update `docs/api.md` and `AGENTS.override.md`.

### Task 4: "Ngày dâu của Em" card

**Files:**
- Create: `kira-memory/kira-memory-ui/src/app/core/cycle.ts`, `kira-memory/kira-memory-ui/src/app/core/cycle.spec.ts`
- Create: `kira-memory/kira-memory-ui/src/app/features/gallery/cycle-card.ts`
- Modify: `kira-memory/kira-memory-ui/src/app/core/api.ts` (+ `Cycle`, `cycle()`, `addCycleStart(day)`, `deleteCycleStart(day)`)
- Modify: `kira-memory/kira-memory-ui/src/app/core/since.ts` (export `Ymd`; add `addDays(d: Ymd, n: number): Ymd`, `daysBetween(from: Ymd, to: Ymd): number`, `isoDay(d: Ymd): string`, `parseDay(iso: string): Ymd`)
- Modify: `kira-memory/kira-memory-ui/src/app/features/gallery/gallery.page.{ts,html,css}` (counters strip under the header)

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces: `CycleState = {kind:'none'} | {kind:'during', day, next, length} | {kind:'before', daysLeft, next, length} | {kind:'late', lateBy, next, length}` (`next: Ymd`, `length` = cycle days); `cycleState(starts: readonly string[], today: Ymd): CycleState`; constants `PERIOD_DAYS = 5`, `DEFAULT_CYCLE = 28`, gaps used: last 6 within 21–45 days, average rounded.

- [ ] **Step 1: Write the failing tests** in `cycle.spec.ts`: `[]` → none; `['2026-11-10']`, today 2026-11-27 → before, daysLeft 11, next 2026-12-08, length 28; `['2026-09-02','2026-11-01','2026-05-01','2026-10-03','2026-11-01']` (unsorted, duplicate) → length 30 (gaps 29 and 31; 124 ignored), today 2026-11-27 → before, daysLeft 4, next 2026-12-01; `['2026-11-25']`, today 2026-11-27 → during, day 3; `['2026-10-20']`, today 2026-11-27 → late, lateBy 10; `['2026-10-30']`, today 2026-11-27 (the predicted day) → before, daysLeft 0.
- [ ] **Step 2: Run** UI tests. Expected: FAIL.
- [ ] **Step 3: Implement** `cycleState` and the `since.ts` date helpers, the API methods, and `CycleCard` (`app-cycle-card`): loads `api.cycle()`; shows "Còn N ngày · khoảng dd/MM", "Đang trong kỳ · ngày N", "Trễ N ngày", "Có thể là hôm nay"; note "Sắp tới rồi, nhớ giữ ấm nha ❤" when daysLeft ≤ 3; `none` → invitation to log the last start; button "Hôm nay đến rồi" (hidden while `during`); "Ghi ngày khác" date input (`max` = today); `<details>` of logged days with delete; errors via `errorMessage`. Gallery: remove `days` and the "Bên nhau … ngày" line; add `<section class="counters">` with the cards between `</header>` and the albums nav (grid, 1 column on phones).
- [ ] **Step 4: Run** UI tests. Expected: PASS.

### Task 5: Love-days card and milestone effects

**Files:**
- Modify: `kira-memory/kira-memory-ui/src/app/core/since.ts`, `kira-memory/kira-memory-ui/src/app/core/since.spec.ts`
- Create: `kira-memory/kira-memory-ui/src/app/features/gallery/love-days.ts`, `kira-memory/kira-memory-ui/src/app/features/gallery/celebration.ts`
- Modify: `kira-memory/kira-memory-ui/src/app/features/gallery/gallery.page.html`

**Interfaces:**
- Consumes: Task 4 date helpers and the counters strip.
- Produces: `Tier = 'small' | 'medium' | 'big'`; `Milestone {title: string; tier: Tier; date: Ymd; daysLeft: number}`; `milestoneOn(today: Ymd, start?: Ymd): Milestone | null`; `nextMilestone(today: Ymd, start?: Ymd): Milestone` (strictly after today; hundreds, thousands, repdigits, anniversaries — not month-days).
- Copy: anniversary `Tròn N năm bên nhau` (big); thousand / hundred `Tròn 3.100 ngày bên nhau` (big / medium); repdigit `Ngày thứ 3.333 bên nhau` (big); month-day `Tròn N tháng bên nhau` (small). Priority anniversary > thousand > repdigit > hundred > month.

- [ ] **Step 1: Write the failing tests** in `since.spec.ts`: 2019-06-14 → big "Tròn 1 năm bên nhau"; 2026-08-31 (day 3000) → big "Tròn 3.000 ngày bên nhau"; 2026-12-09 (3100) → medium; 2026-12-14 → small "Tròn 102 tháng bên nhau"; 2027-07-30 (3333) → big "Ngày thứ 3.333 bên nhau"; 2030-08-14 (4444, also a month-day) → the repdigit; 2026-11-27 → null. `nextMilestone`: 2026-11-27 → "Tròn 3.100 ngày bên nhau", daysLeft 12, date 2026-12-09; 2026-12-09 → 3.200 at 2027-03-19, daysLeft 100; 2027-03-19 → "Tròn 9 năm bên nhau" at 2027-06-14, daysLeft 87.
- [ ] **Step 2: Run** UI tests. Expected: FAIL.
- [ ] **Step 3: Implement** the functions; `Celebration` (`app-celebration`, input `milestone`, output `closed`): fixed full-screen layer with `pointer-events: none`, particles generated once (small: ~14 hearts rising ~5 s; medium: ~36 petals falling ~8 s; big: ~70 confetti + hearts ~10 s, theme colours), a closable card with the title; no particles under `prefers-reduced-motion`; closes itself after ~12 s. `LoveDays` (`app-love-days`): total days, "N năm N tháng N ngày", next milestone line ("Còn N ngày nữa: … (dd/MM)") or today's milestone with "Xem lại 🎉"; plays once per Vietnam day per device via localStorage key `km-celebrated` (try/catch: storage may throw). Add it first in the counters strip.
- [ ] **Step 4: Run** UI tests. Expected: PASS.

### Task 6: Verification

- [ ] **Step 1:** Service verify (Global Constraints). Expected: BUILD SUCCESS, all ITs green.
- [ ] **Step 2:** UI verify (Global Constraints). Expected: all specs pass, production build succeeds within budgets.
- [ ] **Step 3: Runtime check** without touching the user's service on :8086: run the new service with `SERVER_PORT=8096` against the local MySQL/S3Mock (Flyway adds `cycle_start`), `ng serve --port 4216` with a scratchpad proxy to :8096. Upload ~5 images (R2): later files start sending while earlier ones show "đang cất vào kho". Cards render on desktop and phone width; log/delete a period day; with a faked clock on 2026-12-09 and 2027-06-14 the medium and big effects play once and the card closes. Delete the test media and period rows afterwards, stop both processes.
- [ ] **Step 4:** `detect_changes({scope: "all"})` shows only the symbols above.
