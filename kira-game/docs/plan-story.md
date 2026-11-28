# kira-game Phase 2: chuyển "Chừa một dòng" sang Ink — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toàn bộ kịch bản "Chừa một dòng" chạy bằng Ink trong game, qua mọi test kịch bản, chơi được từ đầu tới bốn
kết thúc trên bối cảnh khối hộp, kèm danh sách asset đã chốt.

**Architecture:** Mỗi chương một file Ink. Biến và hàm luật riêng của truyện nằm ở hai file chung. Trong lúc chuyển,
chương chưa viết được thay bằng một kết tạm "Còn tiếp", nên game và test luôn chạy được trên phần đã xong. Mọi kiểm tra
dùng `explore` và `playScript` của Phase 1; bối cảnh khối hộp sinh từ bảng điểm neo của từng chương.

**Tech Stack:** Ink, inkjs, Vitest, `tools/greybox.ts` của Phase 1.

**Spec:** `docs/design.md` mục 6 và 7.3 · Kịch bản: `docs/story/chua-mot-dong.md` · Review và các đề xuất đã chốt:
`docs/story/review.md`.

**Cần có trước:** Phase 1 xong (Task 3, 4, 6, 7, 9 của `docs/plan.md`). Codex đã sửa theo `review.md` mục 2, hoặc chủ
dự án đồng ý dùng các đề xuất mặc định trong đó.

## Global Constraints

- Quy ước Ink theo design §7.3: tên knot, tag, `mo_<knot>()`, `# o:` và `# ten:` là hai dòng đầu của knot phụ và hoạt
  động, luồng `chuong_<n>` → `hub` → `chinh_tiep`.
- Cảnh chính: dòng đầu `~ thoi_diem = "<nhãn>"`, rồi `# den: <dia_diem> <anh_sang> [cach_bay]` trước dòng nội dung đầu
  tiên. Cảnh 1–5 kết thúc bằng `~ buoi_ranh = 1` và `-> hub`. Cảnh 6 có dòng `# ket_chuong` mang thẻ tóm tắt chương.
- Truyện phụ và hoạt động: `~ buoi_ranh = buoi_ranh - 1` ngay sau hai tag đầu, kết thúc bằng `-> hub`.
- Hiệu ứng đúng như kịch bản, cộng các sửa đã chốt ở `review.md`. Bốn chỉ số chỉ đổi qua `doi()`; `tien` đổi bằng phép
  gán, có điều kiện đủ tiền bằng đúng số trừ, và lựa chọn thiếu tiền có bản `#khoa` cùng chữ.
- Chữ trên nút lựa chọn ≤ 60 ký tự. Mỗi dòng hiện ra ≤ 160 ký tự. Mỗi dòng một người nói.
- Không viết cứng từ có giới tính trong câu dùng chung; dùng hàm xưng hô. Đầu câu dùng bản viết hoa (`{Ny_xung()}`).
  `[Tên]` thành `{ten}`.
- Mức nội dung 13+ theo design §6.6.
- Verify mỗi task: `npm test && npm run typecheck` trong `kira-game/`. Chương nào xong thì chơi thử trên trình duyệt
  (bối cảnh khối hộp) khi chủ dự án cho phép.

## Review Focus

1. Lựa chọn ẩn theo điều kiện làm lệch chỉ số lựa chọn: lượt chơi viết sẵn chọn theo chữ (`{ pick: '…' }`), không theo
   số. Áp dụng ở mọi task có lượt viết sẵn.
2. Một truyện phụ có cửa sổ mở sai nên không bao giờ mở: explorer phải bắt đầu được mọi knot phụ và hoạt động (Task 3–6).
3. Hai lần trừ tiền trong cùng một khoảng làm tiền âm: explorer báo `tien < 0` (Task 5).
4. Hàm xưng hô viết thường ở đầu câu ("em sẽ vui…" thay vì "Em sẽ vui…"): test kiểm nguồn (Task 2).
5. Chữ của tuyến này hiện ở tuyến kia (lời về nhà dì Thanh xuất hiện ở tuyến Đà Nẵng): lượt viết sẵn theo từng tuyến
   kiểm có và không có các dòng đặc trưng (Task 5).

---

## Cấu trúc file

```
story/main.ink          INCLUDE lib/core.ink, bien.ink, luat.ink, luong.ink, c1.ink … (và con_tiep.ink khi chưa đủ 4 chương)
story/bien.ink          biến riêng của truyện
story/luat.ink          hàm luật: chot_diem, xet_tuyen, chon_ket, co_lich_chung, nhat_ky_*
story/luong.ink         knot chinh_tiep cho các chương đã viết
story/c1.ink … c4.ink   chuong_<n>, cảnh chính, truyện phụ, hoạt động, mo_*()
story/ket.ink           bốn knot kết thúc ket_1 … ket_4 (Task 6)
story/con_tiep.ink      tạm: chuong_<n+1> của chương chưa viết đặt ket_thuc = "con_tiep"
story/giai_de.json      câu hỏi mini-game giải đề (Task 7)
tools/greybox.ts        thêm bảng bối cảnh và điểm neo (sửa, Task 3–6)
tools/asset-list.ts     in danh sách asset rút từ tag Ink (Task 9)
src/story/cast.ts       thêm nhân vật phụ có thoại (sửa)
src/story/endings.ts    ket_1 … ket_4, tạm thêm con_tiep (sửa)
test/rules.test.ts      hàm luật
test/ink-lint.test.ts   kiểm nguồn Ink
test/story.test.ts      thêm lượt viết sẵn (sửa)
docs/assets.md          danh sách asset đã chốt (Task 9)
docs/balance.md         số liệu cân bằng (Task 8)
```

`story/slice.ink` bị xóa ở Task 3.

## Quy tắc viết thoại

Kịch bản ở dạng tóm tắt cảnh. Người chuyển (Claude hoặc Codex) nở mỗi cảnh thành thoại theo các quy tắc sau.

- Độ dài: cảnh chính 20–40 dòng (2–4 phút đọc), truyện phụ 10–20 dòng, hoạt động 3–6 dòng.
- Giữ nguyên mọi câu thoại trong ngoặc kép của kịch bản; chỉ thay `[Tên]` và xưng hô bằng biến, hàm.
- Lời dẫn ngắn, mỗi dòng một hành động hoặc một hình ảnh. Không kể dài nội tâm, không gọi tên cảm xúc thay người chơi.
- Nhân vật người chơi (`toi:`) nói ít; phần lớn thể hiện qua lựa chọn.
- Nút lựa chọn bắt đầu bằng động từ ("In lại bản màu"). Phần diễn giải dài trong kịch bản thành 1–3 dòng ngay sau lựa
  chọn, rồi nhập lại mạch bằng gather (`-`).
- Mỗi cảnh chính có ít nhất một `# cam` và một `# bieu_cam` ở dòng quan trọng nhất.
- Tin nhắn: dòng có `# tin_nhan`, người nói là người gửi.
- Khác nhau theo tuyến: khối `{ noi_hoc == "da_nang": … - else: … }`. Khác nhau theo lý do tới Huế:
  `{ xep_truoc == "da_nang": … - else: … }` (review mục 3.1).
- Không dùng tiếng lóng theo năm, để truyện không cũ đi.

## Biến và hàm luật

| Tên | Kiểu, giá trị | Đặt ở |
|---|---|---|
| `co_giup_tu`, `co_so_tien`, `co_nhip_hen`, `co_ke_hoach_chung`, `co_moc_nuoc` | bool, mặc định `false` | truyện phụ, cảnh tương ứng trong kịch bản |
| `diem_thi` | số nguyên, mặc định 0 | `chot_diem()` ở đầu `c2_chinh_3` |
| `xep_truoc` | `""`, `"da_nang"`, `"hue"` | lựa chọn ở `c2_chinh_5` |
| `noi_hoc` | `""`, `"da_nang"`, `"hue"`, `"hue_du_phong"` | `xet_tuyen()` ở đầu `c2_chinh_6` |

- `chot_diem()`: `diem_thi = 18 + nang_luc / 10` (chia nguyên).
- `xet_tuyen()`: xếp Đà Nẵng trước và `diem_thi ≥ 24` → `"da_nang"`; ngược lại `diem_thi ≥ 22` → `"hue"`; còn lại
  `"hue_du_phong"`.
- `co_lich_chung()`: `co_nhip_hen or co_ke_hoach_chung`.
- `chon_ket(loi_chon)` với `loi_chon` là `"thu_tiep"`, `"chia_tay"` hoặc `"doi"`, gọi sau khi đã cộng hiệu ứng của lựa
  chọn cuối: `"chia_tay"` → `"ket_3"`; `"doi"` → `"ket_4"`; `tinh_cam ≤ 35` → `"ket_4"`; `tinh_cam ≥ 70` và
  `co_lich_chung()` → `"ket_1"` nếu `noi_hoc == "da_nang"`, ngược lại `"ket_2"`; còn lại `"ket_3"`.

---

### Task 1: Biến và hàm luật

**Files:**
- Create: `kira-game/story/bien.ink`, `kira-game/story/luat.ink`, `kira-game/test/fixtures/rules.ink`
- Test: `kira-game/test/rules.test.ts`

**Interfaces:**
- Consumes: `compileInk` (Phase 1 Task 3), `StoryRunner` (Phase 1 Task 4).
- Produces: các biến và hàm ở bảng "Biến và hàm luật".

- [ ] **Step 1: Viết fixture và test fail.** `test/fixtures/rules.ink`: `INCLUDE ../../story/lib/core.ink`,
  `INCLUDE ../../story/bien.ink`, `INCLUDE ../../story/luat.ink`, `-> DONE`, và knot `chinh_tiep` gồm `-> DONE` (core
  cần knot này).

```ts
// test/rules.test.ts
const { json } = compileInk('test/fixtures/rules.ink');
const fresh = (vars: Record<string, unknown>) => { const r = new StoryRunner(json); for (const [k, v] of Object.entries(vars)) r.set(k, v); return r; };

it.each([[0, 18], [39, 21], [40, 22], [59, 23], [60, 24], [100, 28]])('chot_diem: nang_luc %i -> %i', (nl, d) => {
  const r = fresh({ nang_luc: nl }); r.call('chot_diem'); expect(r.get('diem_thi')).toBe(d);
});
it.each([
  ['da_nang', 24, 'da_nang'], ['da_nang', 23, 'hue'], ['da_nang', 22, 'hue'], ['da_nang', 21, 'hue_du_phong'],
  ['hue', 28, 'hue'], ['hue', 22, 'hue'], ['hue', 21, 'hue_du_phong'],
])('xet_tuyen: %s first, %i points -> %s', (xep, diem, noi) => {
  const r = fresh({ xep_truoc: xep, diem_thi: diem }); r.call('xet_tuyen'); expect(r.get('noi_hoc')).toBe(noi);
});
it.each([
  ['chia_tay', 90, true, 'da_nang', 'ket_3'], ['doi', 90, true, 'da_nang', 'ket_4'],
  ['thu_tiep', 70, true, 'da_nang', 'ket_1'], ['thu_tiep', 70, true, 'hue', 'ket_2'],
  ['thu_tiep', 70, true, 'hue_du_phong', 'ket_2'], ['thu_tiep', 70, false, 'da_nang', 'ket_3'],
  ['thu_tiep', 69, true, 'da_nang', 'ket_3'], ['thu_tiep', 36, true, 'hue', 'ket_3'],
  ['thu_tiep', 35, true, 'da_nang', 'ket_4'],
])('chon_ket(%s) tinh_cam %i, lich %s, %s -> %s', (loi, tc, lich, noi, ket) => {
  const r = fresh({ tinh_cam: tc, co_nhip_hen: lich, noi_hoc: noi });
  expect(r.call('chon_ket', [loi])).toBe(ket);
});
it('co_ke_hoach_chung alone counts as a shared schedule', () => {
  expect(fresh({ tinh_cam: 80, co_ke_hoach_chung: true, noi_hoc: 'hue' }).call('chon_ket', ['thu_tiep'])).toBe('ket_2');
});
```

- [ ] **Step 2: Chạy `npx vitest run test/rules.test.ts`.** Expected: FAIL, thiếu `story/bien.ink`.
- [ ] **Step 3: Viết `story/bien.ink` và `story/luat.ink`** theo bảng ở trên.
- [ ] **Step 4: Chạy lại.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): story variables and rule functions`.

### Task 2: Kiểm nguồn Ink và điểm neo

**Files:**
- Create: `kira-game/test/ink-lint.test.ts`
- Modify: `kira-game/test/story.test.ts`

**Interfaces:**
- Consumes: `listInk` (Phase 1 Task 3), file `.glb` khối hộp do `tools/greybox.ts` sinh (Phase 1 Task 9).

- [ ] **Step 1: Viết test.** Mỗi ca in ra file và dòng vi phạm.

```ts
// test/ink-lint.test.ts — chạy trên mọi file .ink trong story/
it('no lowercase pronoun function at the start of a sentence', /* regex (^|[“".!?]\s*)\{(ny_goi_toi|ny_xung|toi_goi_ny|toi_xung)\(\)\} không khớp dòng nào */);
it('no [Tên] placeholder left', /* không dòng nào chứa "[Tên]" */);
it('choice labels are at most 60 characters', /* phần trong [...] của dòng bắt đầu bằng * hoặc +, bỏ #khoa */);
it('tien never goes through doi()', /* không có "doi(tien" */);
it('every locked choice has an unlocked twin with the same label', /* mỗi [X #khoa] có một [X] trong cùng knot */);
it('every side or activity knot starts with # o: then # ten:', /* hai dòng không trống đầu tiên sau === tên === */);
// test/story.test.ts (thêm)
it('every # o anchor exists in that location', async () => {
  // với mỗi `# o: <dia_diem> <diem_neo>` (bỏ dien_thoai): NodeIO đọc assets/locations/<dia_diem>/<dia_diem>-1k.glb, có node tên <diem_neo>
});
it('every speaker with lines has an npc_ anchor where it speaks', /* bỏ qua: sẽ bật ở Phase 3 khi có bản đồ */);
```

  Ca cuối để `it.skip` kèm lời ghi rõ lý do; chỉ ca `# o` chạy ngay.
- [ ] **Step 2: Chạy `npm test`.** Expected: PASS trên `slice.ink` hiện tại (nếu FAIL thì sửa `slice.ink`, không nới
  luật).
- [ ] **Step 3: Commit** `test(kira-game): ink source lint and anchor checks`.

### Task 3: Chương 1 "Đợi mực khô"

**Files:**
- Create: `kira-game/story/c1.ink`, `kira-game/story/luong.ink`, `kira-game/story/con_tiep.ink`
- Modify: `kira-game/story/main.ink`, `kira-game/src/story/cast.ts`, `kira-game/src/story/endings.ts`,
  `kira-game/tools/greybox.ts`, `kira-game/test/story.test.ts`
- Delete: `kira-game/story/slice.ink`

**Interfaces:**
- Consumes: Task 1, Task 2; `explore`, `playScript` (Phase 1 Task 7).
- Produces: `chuong_1`, `c1_chinh_1` … `c1_chinh_6`, năm `c1_phu_*` theo `review.md` mục 2.4, `c1_hd_hoc`, `c1_hd_me`,
  `c1_hd_tu` (`# o: dien_thoai`); `ENDINGS.con_tiep = { title: 'Còn tiếp', summary: 'Chương sau đang được viết.' }`;
  CAST thêm `bac_che` ("Bác bán chè").

- [ ] **Step 1: Viết `c1.ink`** theo kịch bản và quy tắc viết thoại. Cửa sổ mở của truyện phụ, bối cảnh, điểm neo,
  ánh sáng theo `review.md` mục 2.4 và mục 6. Lựa chọn bày tỏ thêm ở `c1_chinh_5`, `c1_chinh_6` nếu chủ dự án đồng ý
  `review.md` mục 4.1.
- [ ] **Step 2: Viết `luong.ink`** (`chinh_tiep` với sáu dòng cho chương 1, cuối knot đặt `ket_thuc = "loi_luong"` rồi
  `-> END`) và `con_tiep.ink` (`=== chuong_2 ===`, `~ ket_thuc = "con_tiep"`, `-> END`). `main.ink` bỏ `slice.ink`,
  thêm các file mới, bắt đầu bằng `-> chuong_1`.
- [ ] **Step 3: Thêm bối cảnh khối hộp** `tiem_photo`, `lop_hoc`, `san_truong`, `ben_xe` vào bảng của
  `tools/greybox.ts`, đủ mọi điểm neo `# o` của chương 1 và `npc_<mã>` cho người nói. Chạy `npm run greybox`.
- [ ] **Step 4: Viết lượt chơi sẵn trong `test/story.test.ts`.**

```ts
it('chapter 1: the study-heavy path leaves nang_luc at 60 or more', async () => {
  // chọn mọi phương án có nang_luc cao nhất; buổi rảnh: c1_hd_hoc, c1_phu_vach_nuoc, c1_phu_chu_tren_bien, rồi 'pass'
  const r = await playScript(json, 'nu', [/* picks theo chữ */]);
  expect(r.ending).toBe('con_tiep'); expect(r.problems).toEqual([]);
  expect(r.runner.get('nang_luc')).toBeGreaterThanOrEqual(60);
});
it('chapter 1: helping Tu sets co_giup_tu', async () => { /* start c1_phu_anh_uot -> co_giup_tu === true */ });
```

- [ ] **Step 5: Chạy `npm test`.** Expected: PASS. Explorer 2000 lượt: chỉ có kết `con_tiep`, không vấn đề, mọi knot
  `c1_phu_*` và `c1_hd_*` được bắt đầu.
- [ ] **Step 6: Chủ dự án chơi chương 1 trên trình duyệt và duyệt giọng văn.** Các chương sau chờ mốc này.
- [ ] **Step 7: Commit** `feat(kira-game): chapter 1 in ink`.

### Task 4: Chương 2 "Thứ tự nguyện vọng"

**Files:**
- Create: `kira-game/story/c2.ink`
- Modify: `kira-game/story/luong.ink`, `kira-game/story/con_tiep.ink` (thành `chuong_3`), `kira-game/story/main.ink`,
  `kira-game/tools/greybox.ts` (thêm `quan_ghe_nhua`), `kira-game/test/explorer.ts` (thêm `count`),
  `kira-game/test/story.test.ts`

**Interfaces:**
- Produces: `chuong_2` … `c2_chinh_6`, năm `c2_phu_*`, `c2_hd_hoc`, `c2_hd_me`, `c2_hd_tu`. `co_yeu_nhau = true` ở cuối
  `c2_chinh_1`. `chot_diem()` ở đầu `c2_chinh_3`. `xep_truoc` đặt theo lựa chọn ở `c2_chinh_5`. `xet_tuyen()` ở đầu
  `c2_chinh_6`; ba nhánh chữ của `c2_chinh_6` theo `noi_hoc` và `xep_truoc`.

- [ ] **Step 1: Viết `c2.ink`.** `c2_phu_de_thu` có hai bản lời dẫn: `buoc_chinh ≤ 2` (trước thi) và lớn hơn (sau thi).
- [ ] **Step 2: Cập nhật `luong.ink`, `con_tiep.ink`, `main.ink`, bối cảnh khối hộp.**
- [ ] **Step 3: Viết bốn lượt chơi sẵn, mỗi lượt dừng ở `con_tiep`.**

```ts
it.each([
  ['Đà Nẵng', 'da_nang', 'da_nang', 24],        // chăm học, xếp Đà Nẵng trước
  ['Huế tự chọn', 'hue', 'hue', 22],            // xếp Huế trước, nang_luc 40–59
  ['hụt điểm', 'da_nang', 'hue', 22],           // xếp Đà Nẵng trước, nang_luc 40–59
  ['dự phòng', 'da_nang', 'hue_du_phong', 18],  // nang_luc dưới 40
])('chapter 2 route: %s', async (_, xep, noi, minDiem) => {
  // picks theo chữ, viết sau khi có c1.ink, c2.ink
  expect(r.runner.get('xep_truoc')).toBe(xep); expect(r.runner.get('noi_hoc')).toBe(noi);
  expect(r.runner.get('diem_thi')).toBeGreaterThanOrEqual(minDiem);
  expect(r.runner.get('co_yeu_nhau')).toBe(true);
});
```

  Lượt "dự phòng": chọn các phương án làm giảm `nang_luc` (`c1_chinh_3` "Cầm ô đi cùng", `c2_chinh_2` "Nhận đơn cho
  kịp") và không dùng buổi rảnh cho việc học.
- [ ] **Step 4: Chạy `npm test`.** Expected: PASS; explorer gặp đủ ba giá trị `noi_hoc` (thêm vào `Report` một bộ đếm
  `vars` cho các biến được hỏi: `explore(json, { …, count: ['noi_hoc'] })` trả `counts.noi_hoc`).
- [ ] **Step 5: Commit** `feat(kira-game): chapter 2 in ink`.

### Task 5: Chương 3 "Bữa cơm nguội"

**Files:**
- Create: `kira-game/story/c3.ink`
- Modify: `kira-game/story/luong.ink`, `kira-game/story/con_tiep.ink` (thành `chuong_4`), `kira-game/story/main.ink`,
  `kira-game/tools/greybox.ts` (thêm `phong_tro`, `ga_hue`; cách bày `bt_tiem_in`, `bt_nha_di`, `bt_quan_com`),
  `kira-game/test/story.test.ts`

**Interfaces:**
- Produces: `chuong_3` đặt `tien = 260`, cộng 60 nếu `co_so_tien`. Cảnh theo tuyến dùng `noi_hoc`. `c3_chinh_5` có năm
  phương án; xe buýt chỉ ở tuyến Đà Nẵng, tàu chỉ ở tuyến Huế, mỗi cái có bản `#khoa` khi thiếu tiền; "Nhờ mẹ đổi giờ"
  ẩn khi `gia_dinh < 60`. `c3_phu_muoi_lam_phut` chỉ mở ở buổi rảnh sau cảnh 4. Dấu vết lý do tới Huế theo `review.md`
  mục 3.1.

- [ ] **Step 1: Viết `c3.ink`.** Giá đi gặp theo `review.md` mục 2.3 (50 và 250).
- [ ] **Step 2: Cập nhật luồng, kết tạm, bối cảnh khối hộp.**
- [ ] **Step 3: Viết test cho lựa chọn có điều kiện, dùng `StoryRunner` trực tiếp.**

```ts
const choicesAt = (vars: Record<string, unknown>, knot: string) => {
  const r = new StoryRunner(json); for (const [k, v] of Object.entries(vars)) r.set(k, v); r.jump(knot);
  for (let s = r.step(); ; s = r.step()) if (s.kind === 'choices') return s.choices; else if (s.kind === 'stop') throw new Error('no choices');
};
it('Hue route without money shows the train locked and the 15-minute call open', () => {
  const c = choicesAt({ noi_hoc: 'hue', tien: 100, gia_dinh: 45 }, 'c3_chinh_5');
  expect(c.find(x => x.text.startsWith('Đi tàu'))?.locked).toBe(true);
  expect(c.find(x => x.text.startsWith('Hẹn gọi 15 phút'))?.locked).toBe(false);
  expect(c.some(x => x.text.startsWith('Nhờ mẹ'))).toBe(false);
  expect(c.some(x => x.text.startsWith('Đi xe buýt'))).toBe(false);
});
it('Hue route with money opens the train', () => { /* tien: 250 -> locked false */ });
it('Da Nang route offers the bus, never the train', () => { /* noi_hoc 'da_nang' */ });
it('high gia_dinh shows the ask-mom option', () => { /* gia_dinh: 60 */ });
it('chapter 3 never shows Hue-only lines on the Da Nang route', async () => {
  // lượt Đà Nẵng đi hết chương 3: r.transcript không chứa "Dì Thanh để phần canh"; lượt Huế thì có
});
```
- [ ] **Step 4: Chạy `npm test`.** Expected: PASS; explorer không báo `tien < 0`.
- [ ] **Step 5: Commit** `feat(kira-game): chapter 3 in ink`.

### Task 6: Chương 4 "Chuyến xe sau Tết" và bốn kết

**Files:**
- Create: `kira-game/story/c4.ink`, `kira-game/story/ket.ink`
- Modify: `kira-game/story/luong.ink`, `kira-game/story/main.ink`, `kira-game/src/story/endings.ts`,
  `kira-game/tools/greybox.ts` (thêm `van_phong`; cách bày `bt_tet`), `kira-game/test/story.test.ts`
- Delete: `kira-game/story/con_tiep.ink`

**Interfaces:**
- Produces: `c4_chinh_6` gọi `chon_ket()` với lời chọn cuối rồi `-> ket_<n>`; mỗi knot kết đặt `ket_thuc` và có các
  biến thể trong kịch bản (kết 3 theo `tinh_cam ≤ 35`, kết 4 theo lời chọn); dòng hậu truyện `co_moc_nuoc` ở cuối cả
  bốn kết. `ENDINGS` = `{ ket_1: { title: 'Một bàn hai ghế', summary }, ket_2: { title: 'Tới nơi thì nhắn', summary },
  ket_3: { title: 'Gấp lại', summary }, ket_4: { title: 'Tin nhắn chưa gửi', summary } }`; bỏ `con_tiep`.

- [ ] **Step 1: Viết `c4.ink` và `ket.ink`.**
- [ ] **Step 2: Cập nhật luồng, `main.ink`, `ENDINGS`, bối cảnh khối hộp; xóa `con_tiep.ink`.**
- [ ] **Step 3: Viết bảy lượt chơi sẵn**, mỗi lượt một dòng trong bảng:

| Lượt | Tuyến | Đường đi chính | Kết |
|---|---|---|---|
| 1 | Đà Nẵng | chọn ở bên nhau, có `co_nhip_hen`, "Thử tiếp" | `ket_1` |
| 2 | Huế, ít tiền | "Hẹn gọi 15 phút", "Thử tiếp" | `ket_2` |
| 3 | Huế, đủ tiền | đi tàu ở `c3_chinh_5`, "Thử tiếp" | `ket_2` |
| 4 | bất kỳ | "Nói lời chia tay" | `ket_3` |
| 5 | bất kỳ | `tinh_cam` 36–69, "Thử tiếp" | `ket_3` |
| 6 | bất kỳ | "Dời sang hôm khác" | `ket_4` |
| 7 | bất kỳ | hay nhận ca, `tinh_cam ≤ 35`, "Thử tiếp" | `ket_4` |

- [ ] **Step 4: Chạy `npm test`.** Expected: PASS; explorer 2000 lượt gặp đủ bốn kết, mọi knot phụ và hoạt động được
  bắt đầu, không vấn đề.
- [ ] **Step 5: Chủ dự án chơi một lượt trọn vẹn trên trình duyệt.**
- [ ] **Step 6: Commit** `feat(kira-game): chapter 4 and endings in ink`.

### Task 7: Phần chữ ngoài cảnh

**Files:**
- Modify: `kira-game/story/luat.ink`, `kira-game/src/story/endings.ts`
- Create: `kira-game/story/giai_de.json`
- Test: `kira-game/test/rules.test.ts`, `kira-game/test/quiz.test.ts`

**Interfaces:**
- Produces: hàm Ink `nhat_ky_tinh_cam()`, `nhat_ky_nang_luc()`, `nhat_ky_gia_dinh()`, `nhat_ky_ban_be()`, mỗi hàm trả một
  câu theo mức (dưới 35, 35–69, từ 70); câu ở mức "năng lực" đổi theo chương (học hay làm). `giai_de.json`:
  `{ "cau_hoi": [{ "hoi": string, "dap_an": [string, string, string, string], "dung": 0 | 1 | 2 | 3 }] }`, ít nhất 15
  câu. Thẻ tóm tắt bốn chương nằm ở dòng `# ket_chuong` (đã viết ở Task 3–6).

- [ ] **Step 1: Viết test:** mỗi hàm `nhat_ky_*` trả chuỗi khác rỗng ở giá trị 0, 35, 69, 70, 100; `giai_de.json` có
  ≥ 15 câu, mỗi câu đúng 4 đáp án, `dung` trong 0–3, không câu nào trùng.
- [ ] **Step 2: Chạy, xác nhận FAIL; viết nội dung; chạy lại.** Expected: PASS.
- [ ] **Step 3: Chủ dự án duyệt chữ.**
- [ ] **Step 4: Commit** `feat(kira-game): relationship journal, quiz questions, ending summaries`.

### Task 8: Cân bằng

**Files:**
- Create: `kira-game/tools/balance.ts`, `kira-game/docs/balance.md`
- Modify: `kira-game/package.json` (script `balance: node tools/balance.ts`)

**Interfaces:**
- Consumes: `explore` với `count: ['noi_hoc', 'ket_thuc']`.

- [ ] **Step 1: Viết `tools/balance.ts`:** 5000 lượt, seed 7; in tỉ lệ mỗi kết, mỗi `noi_hoc`, tỉ lệ lượt có
  `co_nhip_hen` và tỉ lệ lượt gặp phương án tàu bị khóa.
- [ ] **Step 2: Chạy `npm run balance`, ghi kết quả vào `docs/balance.md`.** Đánh dấu nếu một kết dưới 3% hoặc trên 60%,
  hoặc tuyến Đà Nẵng dưới 10%. Lượt ngẫu nhiên không giống người chơi thật; số liệu chỉ để thấy chỗ lệch quá đà.
- [ ] **Step 3: Đề xuất chỉnh hiệu ứng nếu có chỗ lệch; chủ dự án quyết; chạy lại test.**
- [ ] **Step 4: Commit** `chore(kira-game): balance report`.

### Task 9: Chốt danh sách asset

**Files:**
- Create: `kira-game/tools/asset-list.ts`, `kira-game/docs/assets.md`
- Modify: `kira-game/package.json` (script `assets:list: node tools/asset-list.ts`)

**Interfaces:**
- Produces: `docs/assets.md` gồm: bối cảnh (mã, kiểu ánh sáng, cách bày, điểm neo) rút từ `# den` và `# o`; nhân vật
  (mã, các chương xuất hiện, biểu cảm từ `# bieu_cam`, động tác từ `# anim`); ảnh từ `# anh`; nhạc, hiệu ứng từ
  `# nhac`, `# sfx`.

- [ ] **Step 1: Viết `tools/asset-list.ts`:** đọc mọi `.ink`, gom tag theo bảng trên (tag động trong `{}` thì liệt kê
  mọi nhánh chữ), in Markdown ra stdout.
- [ ] **Step 2: Chạy `npm run assets:list > docs/assets.md`;** thêm tay phần trang phục theo chương (design §6.5) và
  ghi chú cử chỉ hai người.
- [ ] **Step 3: Đối chiếu với giới hạn design §6.5; chủ dự án duyệt.** Đây là mốc "danh sách asset chốt" của design
  §6.7. Phase 4 bắt đầu từ file này.
- [ ] **Step 4: Commit** `docs(kira-game): frozen asset list`.

## Nghiệm thu Phase 2

1. `npm test` và `npm run typecheck` xanh; explorer gặp đủ bốn kết, mọi truyện phụ và hoạt động; không vấn đề.
2. Bảy lượt chơi sẵn ở Task 6 xanh, gồm hai đường tới kết 2.
3. Chủ dự án đã chơi trọn một lượt trên bối cảnh khối hộp, đã duyệt giọng văn chương 1 và phần chữ ngoài cảnh.
4. `docs/assets.md` được duyệt và nằm trong giới hạn design §6.5.
