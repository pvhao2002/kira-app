# kira-game — Kế hoạch build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng game 3D kể chuyện chạy trên trình duyệt theo `docs/design.md`. File này gồm lộ trình cả dự án và kế
hoạch chi tiết Phase 1: một bản thử dọc (vertical slice) chứng minh toàn bộ đường ống, từ kịch bản Ink qua Director tới
thế giới 3D, giao diện, lưu game và đồ họa thích ứng, trên nội dung mẫu lấy từ "Chừa một dòng".

**Architecture:** Web tĩnh (Vite + TypeScript). three.js vẽ một bối cảnh mỗi lúc; inkjs chạy kịch bản; `Director` nối
kịch bản với thế giới 3D và giao diện DOM qua hai cổng `WorldPort` và `UiPort`, nên toàn bộ luồng truyện test được bằng
bản giả trong Node. Bối cảnh là file `.glb`; bối cảnh chưa có đồ họa thật thì game nạp bản khối hộp do tool sinh từ một
bảng. Tiến trình lưu trong localStorage; mức đồ họa tự chọn lúc mở game và tự hạ khi tụt FPS.

**Tech Stack (đã kiểm ngày 2026-11-27):** Node ≥ 22.18, Vite 8.4, TypeScript 7.0 (bản native, lệnh `tsc`), three
0.187 và `@types/three` 0.187, inkjs 2.4, three-mesh-bvh 0.10, detect-gpu 5.0.70, Vitest 5.1, happy-dom 21,
`@gltf-transform/core` 4.5, `@types/node` 22.

**Spec:** `docs/design.md` · Kịch bản: `docs/story/chua-mot-dong.md` · Review và đề xuất đã chốt:
`docs/story/review.md` · Phase 2: `docs/plan-story.md` · Phase 4: `docs/plan-art.md`

## Global Constraints

- Module ở `kira-game/`; code nằm thẳng trong đó (`src/`, `story/`, `tools/`, `test/`, `assets/`). Không import từ
  module khác của repo.
- Node `>=22.18`. Node tự bỏ kiểu TypeScript, nên tool chạy bằng `node tools/<tên>.ts`, không cần tsx hay ts-node. Hệ
  quả cho mọi file `.ts`: chỉ dùng cú pháp xóa được (`erasableSyntaxOnly`: không `enum`, không `namespace`, không tham
  số dạng `private x` trong constructor); import tương đối luôn ghi đuôi `.ts`; import chỉ lấy kiểu phải là
  `import type`.
- TypeScript 7, `strict`, ESM. `tsconfig.json` ghi `types: ["vite/client", "node"]` vì TS 7 không tự nạp `@types`.
  Không dùng `baseUrl`, `paths`, `moduleResolution: node10` (TS 7 đã bỏ).
- Web tĩnh: lúc chạy không gọi mạng ngoài asset của chính game; không cookie, không analytics, không CDN. Đường dẫn tới
  file trong `public/` ghép từ `import.meta.env.BASE_URL`.
- Thiếu WebGL2 thì hiện đúng câu: "Trình duyệt này chưa hỗ trợ WebGL2. Hãy mở game bằng Chrome, Edge, Firefox hoặc
  Safari bản mới."
- Tên người chơi và chữ kịch bản chỉ vào DOM bằng `textContent`, không bao giờ `innerHTML`.
- Tên: chuẩn hóa NFC, bỏ khoảng trắng đầu/cuối, gộp khoảng trắng liền nhau; 1–16 ký tự (đếm code point sau NFC); chỉ
  chữ cái (`\p{L}`, `\p{M}`) và khoảng trắng.
- Ink theo design §7.3. Code chỉ đọc/ghi các biến khai báo trong `story/lib/core.ink` và không biết gì về một truyện cụ
  thể. Tên knot: chính `^c\d+_chinh_\d+$`, phụ `^c\d+_phu_[a-z0-9_]+$`, hoạt động `^c\d+_hd_[a-z0-9_]+$`, đầu chương
  `chuong_<n>`. Knot phụ và hoạt động có hai dòng đầu `# o: <dia_diem> <diem_neo>` (hoặc `# o: dien_thoai`) và
  `# ten: <nhãn>`, cùng hàm `mo_<knot>()`. Director chỉ xét knot có tiền tố `c<chuong>_` của chương đang chơi.
- Tự do = kịch bản dừng, không có lựa chọn, `ket_thuc` rỗng. Kết thúc = kịch bản dừng và `ket_thuc` khác rỗng.
- Lựa chọn mang tag `khoa` hiện mờ và không bao giờ được chọn: UI không gửi, `StoryRunner.choose` ném lỗi.
- Tên node trong `.glb`: điểm neo `spawn_*`, `npc_<mã nhân vật>`, `diem_*`, `cam_*`; va chạm `collider_*` (ẩn khi vẽ);
  cách bày `bt_<cach_bay>`. Code dùng nguyên tên node làm khóa.
- Bối cảnh: game nạp `assets/locations/<mã>/<mã>-<1k|2k>.glb` nếu có, không thì bản khối hộp
  `assets/greybox/<mã>.glb`.
- Mức đồ họa `thap` | `vua` | `cao` theo bảng design §7.5; tự động chỉ hạ; điện thoại ở chế độ tự động tối đa `vua`.
  FPS: cửa sổ 2000 ms; 3 cửa sổ xấu liền nhau thì hạ; ngưỡng PC 50, điện thoại 27; nghỉ 10000 ms sau mỗi lần hạ; bỏ
  cửa sổ có khung > 500 ms hoặc lúc không hiện cảnh 3D; pixel ratio thấp nhất 0.6.
- Khóa localStorage: `kira-game:save`, `kira-game:checkpoints`, `kira-game:profile`. Mọi truy cập bọc try/catch.
- Asset ngoài chỉ CC0, CC-BY hoặc có giấy phép dùng trong game web; mỗi cái một dòng trong `assets/LICENSES.md`.
- Commit chỉ khi chủ dự án cho phép (quy tắc repo); message dạng `feat(kira-game): …`.
- Verify mỗi task: `npm test` và `npm run typecheck` trong `kira-game/`. Phần World và UI xem thêm trên trình duyệt
  (`npm run dev`) khi chủ dự án cho phép.

## Review Focus

1. Bấm một lựa chọn hai lần thật nhanh, bấm phím số của lựa chọn đang khóa, hoặc bấm tương tác hai lần: chỉ đúng một
   hành động hợp lệ tới Ink. Test ở Task 6 (Director từ chối lệnh khi đang chạy) và Task 13 (giao diện).
2. localStorage ném lỗi (Safari ẩn danh, đầy bộ nhớ): game vẫn chạy và báo một lần "Không lưu được tiến trình trên
   trình duyệt này." Test ở Task 5.
3. Save cũ sau khi kịch bản cập nhật (mã phiên bản khác, trạng thái Ink hỏng, biến đã bị xóa khỏi kịch bản): về đầu
   chương đang chơi, bỏ qua biến không còn, báo "Game vừa cập nhật, bạn chơi tiếp từ đầu chương N." Test ở Task 5.
4. Tab bị ẩn, hoặc khựng lúc tải (một khung > 500 ms): không bị tính là máy yếu, không hạ đồ họa. Test ở Task 8.
5. Tên lạ (dấu tổ hợp NFD, emoji, thẻ HTML, toàn khoảng trắng, 17 ký tự): được chuẩn hóa hoặc bị từ chối kèm lời báo
   rõ, và không bao giờ thành HTML. Test ở Task 2 và Task 13.

---

## Lộ trình

| Phase | Mục tiêu | Cần có trước | Xong khi | Kế hoạch |
|---|---|---|---|---|
| **1. Bản thử dọc** | Chứng minh kỹ thuật trên nội dung mẫu, bối cảnh khối hộp, nhân vật tạm | — | Đạt "Nghiệm thu Phase 1" | File này |
| 2. Kịch bản sang Ink | Chuyển "Chừa một dòng" sang Ink từng chương; phần chữ ngoài cảnh; cân bằng; chốt danh sách asset | Phase 1 Task 3, 4, 6, 7, 9 | Đạt "Nghiệm thu Phase 2" | `docs/plan-story.md` |
| 3. Hệ thống còn thiếu | Điện thoại đủ bốn mục, bản đồ, mini-game, nhật ký, âm thanh, trang phục, chơi lại chương…; cả game chơi được trên khối hộp | Phase 1; Phase 2 cho nội dung | Mỗi hệ thống có test và đã xem trên trình duyệt; chơi trọn game tới cả bốn kết trên khối hộp | Phác thảo ở cuối file; viết chi tiết khi bắt đầu |
| 4. Đồ họa và âm thanh | Chủ dự án tự làm bằng công cụ miễn phí và AI, xong chương nào thay chương đó | Phase 2 (`docs/assets.md`); Task 1 làm sớm được | Cả game chạy bằng đồ họa thật trong ngân sách design §7.6 | `docs/plan-art.md` |
| 5. Hoàn thiện | Đo 3 máy chuẩn; tải trước bối cảnh kế; trợ năng; chơi thử với người thật; chỉnh cân bằng | Phase 2–4 | Ngân sách đạt trên 3 máy; tỉ lệ kết thúc hợp lý (`docs/balance.md`) | Viết khi bắt đầu |
| 6. Triển khai | Dockerfile nginx, `nginx.conf` (MIME cho `.glb`, `.ktx2`, `.wasm`; cache; CSP; nén), CI theo kiểu `kira-memory` | Phase 1 (bản xem trước), Phase 5 (bản chính) | Chạy trên tên miền thật sau Cloudflare | Viết khi bắt đầu |

Thứ tự theo design §12 quyết định 20: cả game chơi được bằng khối hộp (Phase 2–3) trước khi làm đồ họa thật (Phase 4).
Phase 3 chạy song song với Phase 2 được; Task 1 của Phase 4 cũng vậy.

## Cấu trúc file Phase 1

```
kira-game/
  package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
  story/main.ink              điểm vào: INCLUDE lib/core.ink và nội dung (Phase 1: bản thử dọc)
  story/lib/core.ink          biến code dùng, doi(), hàm xưng hô, hub
  tools/ink.ts                compileInk(), listInk()
  tools/compile-ink.ts        CLI: story/main.ink -> src/story/story.gen.json
  tools/vendor.ts             chép basis transcoder và benchmark detect-gpu vào public/vendor/
  tools/greybox.ts            bảng GREYBOX, buildGreybox(); chạy trực tiếp thì sinh assets/greybox/<mã>.glb
  assets/LICENSES.md
  assets/greybox/             bối cảnh khối hộp (sinh bằng tool, có trong git)
  assets/characters/robot/    nhân vật tạm CC0
  src/main.ts                 ghép nối, vòng đời app
  src/assets.ts               assetUrl(), hasAsset()
  src/util/hash.ts            fnv1a()
  src/game/name.ts            validateName()
  src/game/save.ts            kiểu dữ liệu lưu, SaveStore, resume()
  src/game/director.ts        Director, WorldPort, UiPort
  src/story/lines.ts          parseLine(), parseTag()
  src/story/runner.ts         StoryRunner
  src/story/cast.ts           CAST, SPEAKERS, displayName(), MODELS, modelOf()
  src/story/endings.ts        ENDINGS
  src/quality/tiers.ts        TIER_SETTINGS, initialTier()
  src/quality/fps-monitor.ts  FpsMonitor
  src/quality/quality.ts      QualityManager
  src/quality/detect.ts       gpuTierFrom(), detectGpu()
  src/world/renderer.ts       hasWebGL2(), createRenderer(), RenderPipeline
  src/world/lighting.ts       LIGHTING, lightingFor()
  src/world/location.ts       extractAnchors(), applyVariant(), activeColliders(), locationPath(), loadLocation()
  src/world/collision.ts      buildCollider(), pushOut()
  src/world/player.ts         moveDelta(), PlayerController
  src/world/characters.ts     resolveName(), CharacterRig
  src/world/camera-rig.ts     orbitPosition(), presetShot(), CameraRig
  src/world/interactables.ts  nearest()
  src/world/world.ts          World (WorldPort thật)
  src/input/keyboard.ts       keysToVector(), Keyboard
  src/input/joystick.ts       joystickVector(), Joystick
  src/ui/dialogue.ts          DialogueBox
  src/ui/title.ts             showTitle(), showNewGame(), chapterCard(), endingScreen()
  src/ui/hud.ts               Hud, gồm hộp "Điện thoại" tối giản
  src/ui/settings.ts          openSettings()
  src/ui/styles.css
  test/                       *.test.ts, fakes.ts, explorer.ts
  test/fixtures/              *.ink; slice.ink là nội dung bản thử dọc
```

Nội dung bản thử dọc nằm ở `test/fixtures/slice.ink`, không ở `story/`. Phase 1 chơi nó qua `story/main.ink`; test
Director và explorer dùng nó lâu dài qua `test/fixtures/slice-main.ink`. Nhờ vậy Phase 2 thay nội dung `story/` mà
không làm vỡ test của Phase 1.

---

### Task 1: Khung module

**Files:**
- Create: `kira-game/package.json`, `kira-game/tsconfig.json`, `kira-game/vite.config.ts`, `kira-game/index.html`,
  `kira-game/.gitignore`, `kira-game/src/main.ts`, `kira-game/src/util/hash.ts`
- Test: `kira-game/test/hash.test.ts`

**Interfaces:**
- Produces: `fnv1a(text: string): string` (8 ký tự hex thường); npm scripts `dev`, `build`, `test`, `typecheck`.

- [ ] **Step 1: Tạo `package.json`, cài thư viện.** `"name": "kira-game"`, `"private": true`, `"type": "module"`,
  `"engines": { "node": ">=22.18" }`. dependencies: `three@^0.187.0`, `inkjs@^2.4.0`, `three-mesh-bvh@^0.10.0`,
  `detect-gpu@^5.0.70`. devDependencies: `vite@^8.4.0`, `typescript@^7.0.2`, `vitest@^5.1.2`, `happy-dom@^21.0.4`,
  `@types/three@^0.187.0`, `@types/node@^22.20.0`, `@gltf-transform/core@^4.5.1`. Scripts: `dev: vite`,
  `build: vite build`, `test: vitest run`, `typecheck: tsc --noEmit`. Chạy `npm install`.
- [ ] **Step 2: Cấu hình.**

```json
{
  "compilerOptions": {
    "target": "ES2023", "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true,
    "allowImportingTsExtensions": true, "verbatimModuleSyntax": true, "erasableSyntaxOnly": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "test", "tools"]
}
```

  `vite.config.ts`: `defineConfig` lấy từ `vitest/config`; `test.environment: 'node'`; `build.chunkSizeWarningLimit:
  1000` (three đã lớn hơn mức cảnh báo mặc định; ngân sách thật là ≤ 400 KB gzip, đo ở Task 14). `.gitignore`:
  `node_modules/`, `dist/`, `public/vendor/`, `src/story/story.gen.json`.
- [ ] **Step 3: Viết test fail**

```ts
// test/hash.test.ts
import { describe, it, expect } from 'vitest';
import { fnv1a } from '../src/util/hash.ts';

describe('fnv1a', () => {
  it('matches FNV-1a 32-bit vectors over UTF-8 bytes', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
    expect(fnv1a('foobar')).toBe('bf9cf968');
  });
  it('tells Vietnamese diacritics apart', () => {
    expect(fnv1a('Hào')).not.toBe(fnv1a('Hao'));
  });
});
```

- [ ] **Step 4: Chạy `npm test`.** Expected: FAIL, không tìm thấy `../src/util/hash.ts`.
- [ ] **Step 5: Implement `fnv1a(text: string): string` trong `src/util/hash.ts`.** Byte UTF-8 từ `TextEncoder`, nhân
  bằng `Math.imul`, kết quả `>>> 0`, hex đệm đủ 8 ký tự.
- [ ] **Step 6: `index.html` và `src/main.ts`.** `<html lang="vi">`, meta viewport
  `width=device-width, initial-scale=1, viewport-fit=cover`, `<canvas id="game">`, `<div id="ui">`,
  `<script type="module" src="/src/main.ts">`. `main.ts` tạm ghi "kira-game" vào `#ui`. Chạy
  `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(kira-game): scaffold Vite + TypeScript module`.

### Task 2: Kiểm tên người chơi

**Files:**
- Create: `kira-game/src/game/name.ts`
- Test: `kira-game/test/name.test.ts`

**Interfaces:**
- Produces: `validateName(raw: string): NameResult`,
  `type NameResult = { ok: true; name: string } | { ok: false; error: string }`.

- [ ] **Step 1: Viết test fail**

```ts
// test/name.test.ts
import { describe, it, expect } from 'vitest';
import { validateName } from '../src/game/name.ts';

describe('validateName', () => {
  it('normalizes and accepts Vietnamese names', () => {
    expect(validateName('  Hào  ')).toEqual({ ok: true, name: 'Hào' });
    expect(validateName('Nguyễn   Văn  A')).toEqual({ ok: true, name: 'Nguyễn Văn A' });
    expect(validateName('Hào')).toEqual({ ok: true, name: 'Hào' });            // NFD -> NFC
    expect(validateName('Ằ'.repeat(16))).toMatchObject({ ok: true });   // 48 code point, sau NFC còn 16
  });
  it('rejects empty, too long and non-letters', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'Hãy nhập tên.' });
    expect(validateName('a'.repeat(17))).toEqual({ ok: false, error: 'Tên tối đa 16 ký tự.' });
    expect(validateName('<b>Hào</b>')).toEqual({ ok: false, error: 'Tên chỉ gồm chữ cái và khoảng trắng.' });
    expect(validateName('Hào123')).toMatchObject({ ok: false });
    expect(validateName('Hào 😀')).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Chạy `npx vitest run test/name.test.ts`.** Expected: FAIL, thiếu module.
- [ ] **Step 3: Implement `validateName` trong `src/game/name.ts`.** Thứ tự: `normalize('NFC')` → `trim()` → gộp `\s+`
  thành một khoảng trắng → rỗng → quá 16 code point (`[...s].length`) → `/^[\p{L}\p{M} ]+$/u`.
- [ ] **Step 4: Chạy lại.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): validate player name`.

### Task 3: Bộ công cụ Ink, thư viện lõi, nội dung bản thử dọc

**Files:**
- Create: `kira-game/tools/ink.ts`, `kira-game/tools/compile-ink.ts`, `kira-game/story/main.ink`,
  `kira-game/story/lib/core.ink`, `kira-game/test/fixtures/slice.ink`, `kira-game/test/fixtures/slice-main.ink`,
  `kira-game/test/fixtures/core-check.ink`, `kira-game/test/fixtures/broken.ink`
- Modify: `kira-game/package.json` (script `story: node tools/compile-ink.ts`; `predev` và `prebuild` chạy
  `npm run story`)
- Test: `kira-game/test/ink.test.ts`

**Interfaces:**
- Produces (`tools/ink.ts`):
  - `compileInk(entryFile: string): { json: string | null; errors: string[]; warnings: string[] }`. Không bao giờ
    ném lỗi; có lỗi thì `json` là `null`. Đường dẫn tính từ thư mục `kira-game/`.
  - `listInk(entryFile: string): { file: string; text: string }[]`: file vào và mọi file nó `INCLUDE` (đệ quy, không
    lặp), theo thứ tự gặp. `file` là đường dẫn tương đối với `kira-game/`, dùng dấu `/`.
- Produces: `src/story/story.gen.json`, bản biên dịch của `story/main.ink`.
- Produces (Ink): `story/lib/core.ink` như dưới; `test/fixtures/slice.ink` (nội dung bản thử dọc) và
  `test/fixtures/slice-main.ink` (`INCLUDE ../../story/lib/core.ink`, `INCLUDE slice.ink`, `-> chuong_1`), dùng ở
  Task 6, 7, 14. `story/main.ink` của Phase 1: `INCLUDE lib/core.ink`, `INCLUDE ../test/fixtures/slice.ink`,
  `-> chuong_1`.

Những điều đã kiểm với inkjs 2.4:
- `import { Compiler, CompilerOptions } from 'inkjs/full'` và `import type { IFileHandler } from
  'inkjs/compiler/IFileHandler'`. Không lấy `Compiler` từ `'inkjs'`, không dùng `PosixFileHandler`: cả hai hỏng lúc
  chạy.
- `new CompilerOptions(entry, [], false, errorHandler, fileHandler)`. `errorHandler(message, type)`: `type` 2 là lỗi;
  0 (dòng TODO) và 1 là cảnh báo.
- `Compile()` ném lỗi khi kịch bản có lỗi ("Compilation failed." hoặc một TypeError bên trong): bọc try/catch; nếu
  `errorHandler` chưa ghi gì thì đưa thông điệp của lỗi vào `errors`. `ToJson()` có kiểu `string | void`, ép
  `as string`.
- File handler: `ResolveInkFilename(name)` nối `name` với thư mục của file vào (Ink tính mọi `INCLUDE`, kể cả lồng
  nhau, từ thư mục file gốc); `LoadInkFileContents(path)` đọc `readFileSync(path, 'utf8')`. `listInk` tính đường dẫn
  theo đúng luật đó, nhận dòng bằng `/^\s*INCLUDE\s+(.+?)\s*$/gm`.
- Lúc chạy: tag đứng riêng một dòng thuộc về dòng nội dung kế tiếp. Tag trong ngoặc vuông của lựa chọn
  (`[… #khoa]`) nằm ở `choice.tags`, chữ lựa chọn không còn tag. Tag đầu knot đọc được bằng `TagsForContentAtPath`
  (không có thì trả `null`) và cũng gắn vào dòng đầu của knot.

`story/lib/core.ink` (biến, `doi`, `hub` chép đúng; mười một hàm xưng hô theo cùng một mẫu, giá trị ở bảng test):

```ink
// Biến code đọc hoặc ghi (design §7.3). Đổi tên ở đây thì phải đổi cả code TypeScript.
VAR ten = ""
VAR gioi_tinh = "nam"
VAR chuong = 1
VAR buoc_chinh = 0
VAR buoi_ranh = 0
VAR thoi_diem = ""
VAR ket_thuc = ""
VAR ket_qua_mini = ""
// Mức đầu theo kịch bản "Chừa một dòng". Bốn chỉ số quan hệ chỉ đổi qua doi().
VAR tinh_cam = 32
VAR nang_luc = 42
VAR gia_dinh = 45
VAR ban_be = 35
// Nghìn đồng. Đổi bằng phép gán, không bao giờ âm (design §6.4).
VAR tien = 0
// Bật ở cuối c2_chinh_1: xưng hô đổi từ cậu/tớ sang anh/em.
VAR co_yeu_nhau = false

=== function doi(ref x, n) ===
~ x = x + n
{ x > 100:
    ~ x = 100
}
{ x < 0:
    ~ x = 0
}

=== function gt_ny() ===
{ gioi_tinh == "nam":
    ~ return "nu"
}
~ return "nam"

=== function anh_em(gt) ===
{ gt == "nam":
    ~ return "anh"
}
~ return "em"

// Anh_em(gt) giống anh_em nhưng trả "Anh"/"Em".

=== function ny_xung() ===
{ co_yeu_nhau:
    ~ return anh_em(gt_ny())
}
~ return "tớ"

=== function Ny_xung() ===
{ co_yeu_nhau:
    ~ return Anh_em(gt_ny())
}
~ return "Tớ"

// ny_goi_toi, Ny_goi_toi, toi_xung, Toi_xung dùng gioi_tinh; toi_goi_ny, Toi_goi_ny dùng gt_ny().
// Chưa yêu thì trả cậu/tớ (Cậu/Tớ). ban_trai_gai, con_trai_gai, ten_ny chỉ theo gioi_tinh.

// Giao thức với Director: còn buổi rảnh thì dừng (chơi tự do), hết thì sang cảnh chính kế tiếp.
=== hub ===
{ buoi_ranh > 0:
    -> DONE
}
~ buoc_chinh = buoc_chinh + 1
-> chinh_tiep
```

`test/fixtures/slice.ink` (chép đúng; test ở Task 6, 7 dựa vào từng chữ và từng con số):

```ink
// Bản thử dọc (Phase 1): phỏng theo c1_chinh_1, c1_chinh_2, c2_chinh_1 của "Chừa một dòng".
// Là fixture của test Director và explorer; Phase 2 bỏ INCLUDE file này khỏi story/main.ink.

=== chuong_1 ===
~ chuong = 1
~ buoc_chinh = 0
~ buoi_ranh = 0
-> hub

=== chuong_2 ===
~ chuong = 2
~ buoc_chinh = 0
~ buoi_ranh = 0
-> hub

=== chinh_tiep ===
{
- chuong == 1 and buoc_chinh == 1: -> c1_chinh_1
- chuong == 1 and buoc_chinh == 2: -> c1_chinh_2
- chuong == 2 and buoc_chinh == 1: -> c2_chinh_1
}
~ ket_thuc = "loi_luong"
-> END

=== c1_chinh_1 ===
~ thoi_diem = "Lớp 10 · Tháng mười"
# den: tiem_photo ngay
# cam: toan_canh
Chiều sau mưa. Có người chạy vào tiệm, một tay ôm đôi giày ướt.
# cam: can_mat ny
ny: {ten} ơi, in giúp tớ cái áp-phích cho lớp với.
me: Máy vừa kẹt tờ đầu. Hai đứa đợi cô rút giấy nhé.
# bieu_cam: ny ngac_nhien
ny: Cậu đo mực nước ở bậc cửa thật à?
* [In lại bản màu, sửa tiêu đề cùng Khánh]
    ~ doi(tinh_cam, 6)
    ~ doi(gia_dinh, -2)
    toi: Để tớ in lại bản màu. Tiêu đề mất dấu rồi.
* [In bản đen trắng rồi quay lại làm đề]
    ~ doi(tinh_cam, 3)
    ~ doi(nang_luc, 5)
    toi: Tớ in đen trắng cho cậu dò chữ trước nhé.
* {tien >= 10} [Mời Khánh cốc chè · 10 nghìn]
    ~ tien = tien - 10
    ~ doi(tinh_cam, 4)
* {tien < 10} [Mời Khánh cốc chè · 10 nghìn #khoa]
- Tờ in hỏng được xếp vào ngăn giấy nháp.
~ buoi_ranh = 1
-> hub

=== c1_phu_vach_nuoc ===
# o: tiem_photo diem_bac_cua
# ten: Đo lại vạch nước
~ buoi_ranh = buoi_ranh - 1
# den: tiem_photo ngay
# thoi_tiet: mua
# cam: qua_vai
Mưa lại dồn về phía chân máy photocopy.
toi: Nước vào từ ngoài cửa, không phải từ trong ra.
~ doi(tinh_cam, 2)
~ doi(nang_luc, 5)
-> hub

=== function mo_c1_phu_vach_nuoc() ===
~ return not c1_phu_vach_nuoc

=== c1_hd_hoc ===
# o: dien_thoai
# ten: Ôn bài với Khánh
~ buoi_ranh = buoi_ranh - 1
# mini: giai_de
ny: Hôm nay mình làm phần hình nhé.
{ ket_qua_mini == "thang":
    ~ doi(nang_luc, 2)
}
~ doi(tinh_cam, 2)
~ doi(nang_luc, 4)
-> hub

=== function mo_c1_hd_hoc() ===
~ return not c1_hd_hoc

=== c1_chinh_2 ===
~ thoi_diem = "Lớp 10 · Cuối học kỳ một"
# den: lop_hoc ngay
Tú bê tới ba cái ghế và một đề Toán gấp làm quạt.
tu: Ổi đây. Giải xong câu này mới được ăn.
ny: Tớ lại ghi sai dấu rồi.
* [Kéo Tú vào giải cùng]
    ~ doi(tinh_cam, 4)
    ~ doi(ban_be, 7)
    ~ doi(nang_luc, 3)
* [Chữa kỹ phần mình sai]
    ~ doi(tinh_cam, 2)
    ~ doi(nang_luc, 7)
- Năm lớp 10 khép lại. # ket_chuong
-> chuong_2

=== c2_chinh_1 ===
~ thoi_diem = "Lớp 12 · Sau Tết"
# den: tiem_photo toi tet
ny: Thứ Bảy tớ rủ cậu đi ăn chè nhé. Hôm ấy tớ để vở Toán ở nhà.
~ co_yeu_nhau = true
# cam: can_mat ny
ny: Lần tới gặp, {ny_xung()} ghi vào dòng này nhé. {Ny_xung()} giữ một nửa tờ.
{ tinh_cam >= 40:
    ~ ket_thuc = "slice_gan"
- else:
    ~ ket_thuc = "slice_xa"
}
-> END
```

Đường đi đã chạy thử: Nam, "In lại bản màu", `c1_phu_vach_nuoc`, "Kéo Tú" → `tinh_cam` 44, `slice_gan`, Khánh xưng
"em". Nữ, "In bản đen trắng", `c1_hd_hoc`, "Chữa kỹ" → `tinh_cam` 39, `slice_xa`, Khánh xưng "anh".

- [ ] **Step 1: Viết fixture và test fail.** `core-check.ink`: `INCLUDE ../../story/lib/core.ink`, `-> DONE`,
  `=== function tang_tc(n) ===` gọi `~ doi(tinh_cam, n)`, và `=== chinh_tiep ===` chỉ có `-> DONE` (`hub` cần knot
  này). `broken.ink`: `-> khong_co` (knot không tồn tại).

```ts
// test/ink.test.ts
import { describe, it, expect } from 'vitest';
import { Story } from 'inkjs';
import { compileInk, listInk } from '../tools/ink.ts';

describe('ink tools', () => {
  it.each(['story/main.ink', 'test/fixtures/slice-main.ink'])('%s compiles cleanly', (f) => {
    const r = compileInk(f);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.json).toBeTypeOf('string');
  });
  it('reports errors instead of throwing', () => {
    const r = compileInk('test/fixtures/broken.ink');
    expect(r.json).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('lists every included file', () => {
    expect(listInk('story/main.ink').map((f) => f.file))
      .toEqual(['story/main.ink', 'story/lib/core.ink', 'test/fixtures/slice.ink']);
  });
});

const json = compileInk('test/fixtures/core-check.ink').json!;
describe('core.ink', () => {
  it('starts with the story values', () => {
    const s = new Story(json);
    for (const [k, v] of Object.entries({ tinh_cam: 32, nang_luc: 42, gia_dinh: 45, ban_be: 35, tien: 0, co_yeu_nhau: false }))
      expect(s.variablesState[k]).toBe(v);
  });
  it('doi clamps to 0..100', () => {
    const s = new Story(json);
    s.variablesState['tinh_cam'] = 98;
    s.EvaluateFunction('tang_tc', [5]);
    expect(s.variablesState['tinh_cam']).toBe(100);
    s.EvaluateFunction('tang_tc', [-150]);
    expect(s.variablesState['tinh_cam']).toBe(0);
  });
  it.each([
    // hàm,           nam chưa yêu, nam đã yêu, nữ chưa yêu, nữ đã yêu
    ['ny_goi_toi',   'cậu', 'anh', 'cậu', 'em'],
    ['ny_xung',      'tớ',  'em',  'tớ',  'anh'],
    ['toi_goi_ny',   'cậu', 'em',  'cậu', 'anh'],
    ['toi_xung',     'tớ',  'anh', 'tớ',  'em'],
    ['Ny_goi_toi',   'Cậu', 'Anh', 'Cậu', 'Em'],
    ['Ny_xung',      'Tớ',  'Em',  'Tớ',  'Anh'],
    ['Toi_goi_ny',   'Cậu', 'Em',  'Cậu', 'Anh'],
    ['Toi_xung',     'Tớ',  'Anh', 'Tớ',  'Em'],
    ['ban_trai_gai', 'bạn gái', 'bạn gái', 'bạn trai', 'bạn trai'],
    ['con_trai_gai', 'con trai', 'con trai', 'con gái', 'con gái'],
    ['ten_ny',       'An Khánh', 'An Khánh', 'Minh Khánh', 'Minh Khánh'],
  ])('%s follows gender and co_yeu_nhau', (fn, ...want) => {
    const s = new Story(json);
    const got = [['nam', false], ['nam', true], ['nu', false], ['nu', true]].map(([g, y]) => {
      s.variablesState['gioi_tinh'] = g;
      s.variablesState['co_yeu_nhau'] = y;
      return s.EvaluateFunction(fn as string);
    });
    expect(got).toEqual(want);
  });
});
```

- [ ] **Step 2: Chạy `npx vitest run test/ink.test.ts`.** Expected: FAIL, thiếu `tools/ink.ts`.
- [ ] **Step 3: Implement `compileInk` và `listInk` trong `tools/ink.ts`** theo các điều đã kiểm ở trên.
- [ ] **Step 4: Viết `story/lib/core.ink`, `test/fixtures/slice.ink`, `test/fixtures/slice-main.ink`,
  `story/main.ink`** theo Interfaces.
- [ ] **Step 5: Implement `tools/compile-ink.ts`.** Gọi `compileInk('story/main.ink')`; có lỗi thì in ra và
  `process.exit(1)`; không thì `mkdirSync('src/story', { recursive: true })` rồi ghi `src/story/story.gen.json`.
- [ ] **Step 6: Chạy `npm test && npm run story`.** Expected: test PASS; có `src/story/story.gen.json`.
- [ ] **Step 7: Commit** `feat(kira-game): ink toolchain, core library and vertical slice content`.

### Task 4: StoryRunner, dòng thoại, tag, tên hiển thị, kết thúc

**Files:**
- Create: `kira-game/src/story/lines.ts`, `kira-game/src/story/cast.ts`, `kira-game/src/story/endings.ts`,
  `kira-game/src/story/runner.ts`, `kira-game/test/fixtures/runner.ink`
- Test: `kira-game/test/lines.test.ts`, `kira-game/test/runner.test.ts`

**Interfaces:**
- Consumes: `compileInk` (Task 3, chỉ trong test).
- Produces:

```ts
// lines.ts
export type Tag = { key: string; args: string[] };
export function parseTag(raw: string): Tag;
// cắt ở dấu ':' đầu tiên; args tách theo khoảng trắng: 'den: tiem_photo toi tet' -> { key: 'den', args: ['tiem_photo', 'toi', 'tet'] };
// 'khoa' -> { key: 'khoa', args: [] }; 'ten: Đo lại vạch nước' -> { key: 'ten', args: ['Đo', 'lại', 'vạch', 'nước'] }
export function parseLine(raw: string, speakers: ReadonlySet<string>): { speaker: string | null; text: string };
// cast.ts
export type Gender = 'nam' | 'nu';
export interface CastEntry { name: string }
export const CAST: Record<string, CastEntry>;     // Phase 1: toi (name ''), ny 'Khánh', me 'Mẹ', tu 'Tú'
export const SPEAKERS: ReadonlySet<string>;        // = khóa của CAST
export function displayName(id: string, playerName: string): string;  // 'toi' -> tên người chơi; còn lại CAST[id].name
// endings.ts
export interface Ending { title: string; summary: string }
export const ENDINGS: Record<string, Ending>;
// Phase 1: slice_gan { 'Gần nhau hơn', 'Bản thử: Khánh giữ một nửa tờ giấy.' },
//          slice_xa  { 'Xa nhau một chút', 'Bản thử: tờ giấy vẫn nằm trong ngăn nháp.' }
// runner.ts
export interface Choice { text: string; locked: boolean }
export type StoryStep =
  | { kind: 'line'; speaker: string | null; text: string; tags: Tag[] }
  | { kind: 'choices'; choices: Choice[] }
  | { kind: 'stop' };
export class StoryRunner {
  constructor(json: string, speakers?: ReadonlySet<string>);  // mặc định SPEAKERS
  step(): StoryStep;              // Continue() tới dòng đầu tiên có chữ (sau trim) hoặc có tag; dòng rỗng không tag bỏ qua. Hết dòng: có lựa chọn -> 'choices' (locked = có tag 'khoa'), không -> 'stop'
  choose(index: number): void;    // chỉ số sai hoặc lựa chọn khóa -> throw
  jump(path: string): void;       // ChoosePathString
  get(name: string): unknown;
  set(name: string, value: unknown): void;     // biến không có -> inkjs ném lỗi, để nguyên
  call(fn: string, args?: unknown[]): unknown; // EvaluateFunction
  knots(pattern: RegExp): string[];            // tên knot và hàm khớp pattern, đã sắp xếp (namedContent của mainContentContainer)
  knotTags(knot: string): Tag[];               // TagsForContentAtPath; null -> []
  saveState(): string;
  loadState(json: string): void;
  vars(): Record<string, unknown>;             // khóa của field variablesState trong saveState(), giá trị đọc qua variablesState[tên]
  errors(): string[];                          // lỗi và cảnh báo runtime nhận qua story.onError
}
```

  inkjs chỉ ghi vào trạng thái những biến khác giá trị mặc định, và `variablesState` không duyệt được bằng vòng lặp;
  vì vậy `vars()` đọc danh sách tên từ JSON của `saveState()`.

- [ ] **Step 1: Viết test fail cho `lines.ts` và `cast.ts`**

```ts
// test/lines.test.ts
import { describe, it, expect } from 'vitest';
import { parseLine, parseTag } from '../src/story/lines.ts';
import { displayName } from '../src/story/cast.ts';

const S = new Set(['ny', 'me', 'toi']);
describe('lines', () => {
  it('parses tags', () => {
    expect(parseTag(' den: tiem_photo toi tet ')).toEqual({ key: 'den', args: ['tiem_photo', 'toi', 'tet'] });
    expect(parseTag('cam: can_mat ny')).toEqual({ key: 'cam', args: ['can_mat', 'ny'] });
    expect(parseTag('ket_chuong')).toEqual({ key: 'ket_chuong', args: [] });
  });
  it('detects known speakers only', () => {
    expect(parseLine('ny: Chào cậu.', S)).toEqual({ speaker: 'ny', text: 'Chào cậu.' });
    expect(parseLine('Lời dẫn: trời mưa.', S)).toEqual({ speaker: null, text: 'Lời dẫn: trời mưa.' });
    expect(parseLine('la: ai đây?', S)).toEqual({ speaker: null, text: 'la: ai đây?' });
  });
  it('shows the player name for toi and Khánh for ny', () => {
    expect(displayName('toi', 'Hào')).toBe('Hào');
    expect(displayName('ny', 'Hào')).toBe('Khánh');
    expect(displayName('me', 'Lan')).toBe('Mẹ');
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL; implement `lines.ts`, `cast.ts`, `endings.ts`; chạy lại.** Expected: PASS.
  `parseLine` dùng `/^([a-z0-9_]+):\s*(.*)$/s` và chỉ nhận khi nhóm 1 thuộc `speakers`.
- [ ] **Step 3: Viết fixture và test fail cho `StoryRunner`.** `test/fixtures/runner.ink`: `VAR x = 0`, `VAR tien = 0`;
  dòng `ny: Chào cậu. # cam: can_mat ny`; dòng `Lời dẫn: không phải người nói.`; ba lựa chọn `[Một]` (`~ x = 1`),
  `[Hai]` (`~ x = 2`), `{tien < 5} [Ba · 5 nghìn #khoa]`; gather `- -> DONE`. Knot `c1_phu_a` có hai dòng đầu
  `# o: tiem_photo npc_a`, `# ten: Thử`, rồi `Xong.` và `-> DONE`; hàm `mo_c1_phu_a()` trả `x > 0`.

```ts
// test/runner.test.ts
import { describe, it, expect } from 'vitest';
import { compileInk } from '../tools/ink.ts';
import { StoryRunner } from '../src/story/runner.ts';

const json = compileInk('test/fixtures/runner.ink').json!;
const S = new Set(['ny']);
describe('StoryRunner', () => {
  it('steps lines, tags and choices, and refuses locked choices', () => {
    const r = new StoryRunner(json, S);
    expect(r.step()).toEqual({ kind: 'line', speaker: 'ny', text: 'Chào cậu.', tags: [{ key: 'cam', args: ['can_mat', 'ny'] }] });
    expect(r.step()).toMatchObject({ kind: 'line', speaker: null });
    expect(r.step()).toEqual({ kind: 'choices', choices: [
      { text: 'Một', locked: false }, { text: 'Hai', locked: false }, { text: 'Ba · 5 nghìn', locked: true }] });
    expect(() => r.choose(2)).toThrow();
    r.choose(1);
    expect(r.get('x')).toBe(0);                  // nội dung nhánh chỉ chạy ở lần Continue() kế tiếp
    expect(r.step()).toEqual({ kind: 'stop' });  // nhánh Hai không có chữ: dòng rỗng bị bỏ qua
    expect(r.get('x')).toBe(2);
  });
  it('lists side knots, reads knot tags, calls functions', () => {
    const r = new StoryRunner(json, S);
    expect(r.knots(/^c\d+_phu_/)).toEqual(['c1_phu_a']);
    expect(r.knotTags('c1_phu_a')).toEqual([{ key: 'o', args: ['tiem_photo', 'npc_a'] }, { key: 'ten', args: ['Thử'] }]);
    expect(r.knotTags('mo_c1_phu_a')).toEqual([]);
    expect(r.call('mo_c1_phu_a')).toBe(false);
  });
  it('saves, restores and snapshots changed variables only', () => {
    const a = new StoryRunner(json, S);
    a.step(); a.step(); a.step(); a.choose(1); a.step();
    const b = new StoryRunner(json, S);
    b.loadState(a.saveState());
    expect(b.get('x')).toBe(2);
    expect(a.vars()).toEqual({ x: 2 });
    expect(() => a.set('khong_co', 1)).toThrow();
  });
});
```

- [ ] **Step 4: Chạy, xác nhận FAIL; implement `StoryRunner`; chạy lại.** Expected: PASS. Ink trả dòng rỗng ở chỗ
  chuyển tiếp (nhánh lựa chọn chỉ có `~`, đoạn trước `-> hub`); `step()` bỏ qua dòng rỗng không tag, còn dòng rỗng có
  tag vẫn trả về để Director áp tag.
- [ ] **Step 5: Commit** `feat(kira-game): story runner, line and tag parsing, cast and endings`.

### Task 5: Lưu game

**Files:**
- Create: `kira-game/src/game/save.ts`, `kira-game/test/fixtures/resume.ink`
- Test: `kira-game/test/save.test.ts`

**Interfaces:**
- Consumes: `StoryRunner`, `Gender` (Task 4).
- Produces:

```ts
export type Quality = 'auto' | 'thap' | 'vua' | 'cao';
export interface Settings { quality: Quality; showFps: boolean; textSpeed: number; fontScale: number; reduceMotion: boolean }
export const DEFAULT_SETTINGS: Settings;  // { quality: 'auto', showFps: false, textSpeed: 40, fontScale: 1, reduceMotion: false }
export interface ShownLine { speakerId: string | null; speaker: string | null; text: string; message: boolean }
export interface Place { location: string; lighting: string; variant: string | null }
export interface Save {
  v: 1; storyVersion: string; savedAt: string; name: string; gender: Gender;
  chapter: number; place: Place | null; ink: string; lastLine: ShownLine | null;
}
export interface Checkpoint { chapter: number; storyVersion: string; ink: string; vars: Record<string, unknown> }
export interface Profile { endings: string[]; chaptersDone: number[]; settings: Settings }
export function storageOrNull(): Storage | null;  // null khi localStorage không dùng được (thử setItem rồi removeItem)
export class SaveStore {
  constructor(storage: Storage | null);
  readonly available: boolean;
  load(): Save | null;                    // thiếu, JSON hỏng, sai v -> null
  write(s: Save): boolean;                // lỗi -> false, không ném
  clear(): void;
  checkpoints(): Record<number, Checkpoint>;
  writeCheckpoint(c: Checkpoint): boolean;
  profile(): Profile;                     // thiếu hoặc hỏng -> mặc định; settings trộn với DEFAULT_SETTINGS
  writeProfile(p: Profile): boolean;
}
export type Resume = { mode: 'exact' } | { mode: 'checkpoint'; chapter: number } | { mode: 'none' };
export function resume(runner: StoryRunner, save: Save, checkpoints: Record<number, Checkpoint>, storyVersion: string): Resume;
```

`resume`: (1) cùng `storyVersion` và `loadState(save.ink)` không lỗi → `exact`. (2) Có checkpoint của `save.chapter`:
checkpoint cùng phiên bản thì thử `loadState(cp.ink)`; không được thì đặt từng biến trong `cp.vars` (biến bản mới không
còn thì bỏ qua) rồi `jump('chuong_' + chapter)` → `checkpoint`. (3) Còn lại → `none`.

- [ ] **Step 1: Viết fixture và test fail.** `test/fixtures/resume.ink`: `VAR tinh_cam = 0`, `VAR chuong = 1`; knot
  `chuong_1` (`~ chuong = 1`, dòng `Đầu chương 1.`, `-> DONE`), knot `chuong_2` (`~ chuong = 2`, dòng
  `Đầu chương 2.`, `-> DONE`).

```ts
// test/save.test.ts (trích)
const mem = () => { const m = new Map<string, string>(); return {
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; },
} as Storage; };
const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } } as unknown as Storage;

it('round-trips a save', () => { /* write -> load trả đúng object, gồm place và lastLine */ });
it('treats corrupt JSON as no save and default profile', () => {
  const s = mem(); s.setItem('kira-game:save', '{oops'); s.setItem('kira-game:profile', 'null');
  const store = new SaveStore(s);
  expect(store.load()).toBeNull();
  expect(store.profile().settings).toEqual(DEFAULT_SETTINGS);
});
it('never throws when storage throws', () => {
  const store = new SaveStore(broken);
  expect(store.write(sample)).toBe(false);
  expect(store.load()).toBeNull();
  expect(store.profile().endings).toEqual([]);
});
it('resumes exactly when the story version matches', () => { /* mode 'exact', biến khôi phục */ });
it('falls back to the chapter checkpoint after a story update, skipping removed variables', () => {
  // save.storyVersion = 'old', storyVersion hiện tại = 'new', checkpoint chương 2 có vars { tinh_cam: 40, bien_cu: 1 }
  expect(resume(runner, save, { 2: cp }, 'new')).toEqual({ mode: 'checkpoint', chapter: 2 });
  expect(runner.get('tinh_cam')).toBe(40);
  expect(runner.step()).toMatchObject({ kind: 'line', text: 'Đầu chương 2.' });
});
it('falls back when the ink state is corrupt', () => { /* cùng phiên bản, save.ink = '{}' -> checkpoint */ });
it('returns none without a checkpoint', () => { /* -> { mode: 'none' } */ });
```

- [ ] **Step 2: Chạy `npx vitest run test/save.test.ts`.** Expected: FAIL, thiếu module.
- [ ] **Step 3: Implement `save.ts`** theo Interfaces. Mọi truy cập storage bọc try/catch.
- [ ] **Step 4: Chạy lại.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): local saves, checkpoints and resume`.

### Task 6: Director

**Files:**
- Create: `kira-game/src/game/director.ts`, `kira-game/test/fakes.ts`, `kira-game/test/fixtures/director.ink`
- Test: `kira-game/test/director.test.ts`

**Interfaces:**
- Consumes: `StoryRunner`, `Choice`, `Tag`, `displayName` (Task 4); `ShownLine`, `Place` (Task 5).
- Produces:

```ts
export type CameraPreset = { kind: 'toan_canh' } | { kind: 'qua_vai' } | { kind: 'can_mat'; who: string };
export interface Marker { knot: string; label: string; location: string; anchor: string }  // location 'dien_thoai' -> anchor ''
export interface WorldPort {
  goTo(p: Place): Promise<void>;
  camera(p: CameraPreset): void;
  expression(who: string, expr: string): void;
  anim(who: string, clip: string): void;
  speaking(who: string | null): void;     // người nói của dòng sắp hiện; null là lời dẫn
  markers(list: Marker[]): void;          // chỉ các dấu ở bối cảnh hiện tại
  freeRoam(on: boolean): void;
}
export interface HudState { chapter: number; freeSlots: number; label: string; phone: Marker[] }
export interface UiPort {
  line(l: ShownLine): Promise<void>;
  choose(choices: Choice[]): Promise<number>;
  chapterCard(text: string): Promise<void>;
  ending(id: string): Promise<void>;
  hud(h: HudState | null): void;          // null khi rời chế độ tự do
  toast(text: string): void;
}
export type PersistEvent = { kind: 'progress' } | { kind: 'chapter'; chapter: number } | { kind: 'ending'; id: string };
export interface DirectorDeps { runner: StoryRunner; world: WorldPort; ui: UiPort; playerName: string; persist(e: PersistEvent): void }
export class Director {
  constructor(deps: DirectorDeps);
  place: Place | null;                    // nơi đang đứng, cập nhật theo # den; main đặt lại khi chơi tiếp
  lastLine: ShownLine | null;
  run(): Promise<'free' | 'ended'>;
  available(): Marker[];                  // truyện đang mở của chương này, sắp theo tên knot
  start(knot: string): Promise<'free' | 'ended'>;  // knot chưa mở -> reject
  passTime(): Promise<'free' | 'ended'>;
}
```

Vòng `run()` (`start`, `passTime`, `run` gọi khi đang chạy thì reject; đặt cờ bận ở đầu, gỡ ở `finally`):
1. `step()` ra `line`. Áp tag theo thứ tự:
   - `den`: `place = { location: args[0], lighting: args[1] ?? 'ngay', variant: args[2] ?? null }`. Khác `this.place`
     thì `await world.goTo(place)`; trùng thì không tải lại.
   - `cam`: `toan_canh`, `qua_vai`, `can_mat <nv>` thành `CameraPreset`; preset lạ thì cảnh báo. `bieu_cam <nv> <bc>`,
     `anim <nv> <clip>` gọi World.
   - `mini`: Phase 1 đặt `ket_qua_mini = "bo_qua"` và toast "Mini-game sẽ có ở bản sau." (Phase 3 thay bằng mini-game
     thật).
   - `tin_nhan`: đánh dấu dòng là tin nhắn. `o`, `ten`: bỏ qua (tag đầu knot gắn vào dòng đầu). `nhac`, `sfx`, `anh`,
     `thoi_tiet`: bỏ qua ở Phase 1. Tag khác: `console.warn` một lần cho mỗi khóa.
   - Dòng có `ket_chuong`: `await ui.chapterCard(text)`, rồi `persist({ kind: 'chapter', chapter: chuong + 1 })`.
     Dòng thường có chữ: `lastLine = { speakerId, speaker, text, message }` (tên từ `displayName`), `world.speaking(...)`,
     `await ui.line(lastLine)`. Chữ rỗng thì không hiện.
2. `step()` ra `choices`: `persist({ kind: 'progress' })`, rồi `runner.choose(await ui.choose(choices))`.
3. `step()` ra `stop`: `ket_thuc` khác rỗng thì `persist({ kind: 'ending', id })`, `await ui.ending(id)`, trả
   `'ended'`. Ngược lại vào tự do: `world.markers(dấu có location trùng place.location)`, `ui.hud({ chapter,
   freeSlots: buoi_ranh, label: 'Chương N · <thoi_diem>', phone: dấu có location 'dien_thoai' })`,
   `world.freeRoam(true)`, `persist({ kind: 'progress' })`, trả `'free'`.

`available()`: knot khớp `^c<chuong>_(phu|hd)_`; thiếu tag `o` hoặc `ten` thì bỏ qua kèm cảnh báo; `call('mo_' + knot)`
ném lỗi (thiếu hàm) thì coi như đóng kèm cảnh báo; `label` là các args của `ten` nối bằng khoảng trắng. `start(knot)` và
`passTime()`: `world.freeRoam(false)`, `world.markers([])`, `ui.hud(null)`; `passTime` đặt `buoi_ranh = 0` rồi
`jump('hub')`; `start` thì `jump(knot)`; cả hai rồi chạy như `run()`.

- [ ] **Step 1: Viết bản giả, fixture và test fail.** `test/fakes.ts`: `FakeWorld` và `FakeUi` ghi mọi lời gọi vào
  mảng `log` (`'goTo:tiem_photo/ngay/-'`, `'camera:can_mat:ny'`, `'speaking:ny'`, `'line:Khánh:…'`, `'card:…'`,
  `'ending:…'`, `'toast:…'`). `FakeUi` nhận hàng đợi chữ lựa chọn; `choose` lấy chữ đầu hàng đợi, trả chỉ số lựa chọn
  không khóa bắt đầu bằng chữ đó; hàng đợi rỗng thì trả một promise không bao giờ xong (dùng để thử lúc Director bận).
  `test/fixtures/director.ink` (`INCLUDE ../../story/lib/core.ink`, `-> chuong_2`, có `chuong_2` và `chinh_tiep` như
  bản thử dọc): một cảnh chính ở `lop_hoc` có hai dòng mang tag lạ `# la: x` rồi cho một buổi rảnh; `c1_phu_cu` (có `# o`, `# ten`, `mo_` luôn đúng, nhưng thuộc
  chương 1); `c2_phu_thieu_mo` (có `# o`, `# ten`, không có hàm `mo_`); `c2_phu_thieu_tag` (có `mo_`, thiếu `# o` và
  `# ten`).

```ts
// test/director.test.ts (các ca cần có; cảnh mẫu từ test/fixtures/slice-main.ink)
it('loads the place before the first line', /* goTo:tiem_photo/ngay/- đứng trước line đầu tiên */);
it('names toi after the player and ny as Khánh', /* 'line:Test:Để tớ in lại…', 'line:Khánh:Test ơi, in giúp…' */);
it('persists progress before waiting on a choice', /* persist progress; director.lastLine.text === 'Cậu đo mực nước ở bậc cửa thật à?' */);
it('passes locked choices to the ui', /* lựa chọn thứ ba { text: 'Mời Khánh cốc chè · 10 nghìn', locked: true } */);
it('enters free roam with world markers and phone stories', () => {
  // run() -> 'free'; markers [{ knot: 'c1_phu_vach_nuoc', label: 'Đo lại vạch nước', location: 'tiem_photo', anchor: 'diem_bac_cua' }]
  // hud { chapter: 1, freeSlots: 1, label: 'Chương 1 · Lớp 10 · Tháng mười', phone: [c1_hd_hoc với label 'Ôn bài với Khánh'] }
});
it('does not reload when a side story stays in the same place', /* start('c1_phu_vach_nuoc') tới hết: goTo đúng 3 lần: tiem_photo/ngay/-, lop_hoc/ngay/-, tiem_photo/toi/tet */);
it('shows the chapter card, then checkpoints the next chapter', /* card:Năm lớp 10 khép lại. rồi persist { kind: 'chapter', chapter: 2 } */);
it('sets ket_qua_mini to bo_qua and toasts for # mini', /* start('c1_hd_hoc') -> runner.get('ket_qua_mini') === 'bo_qua' */);
it('ends with the id the story chose', /* hai đường ở Task 3 -> ending slice_gan và slice_xa; persist ending trước ui.ending */);
it('offers only open stories of the current chapter and warns about broken ones', /* director.ink: available() = []; console.warn cho tag 'la' đúng một lần, cho c2_phu_thieu_mo, cho c2_phu_thieu_tag */);
it('rejects start and passTime while a scene is running', /* FakeUi không có lựa chọn: run() treo ở lựa chọn; passTime() reject */);
it('rejects a story that is not open', /* start('c1_phu_khong_co') reject */);
```

- [ ] **Step 2: Chạy `npx vitest run test/director.test.ts`.** Expected: FAIL, thiếu module.
- [ ] **Step 3: Implement `Director`** theo vòng `run()` ở trên.
- [ ] **Step 4: Chạy lại.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): director drives story, world and ui ports`.

### Task 7: Kiểm tra kịch bản tự động

**Files:**
- Create: `kira-game/test/explorer.ts`, `kira-game/test/fixtures/buggy.ink`
- Test: `kira-game/test/explorer.test.ts`, `kira-game/test/story.test.ts`

**Interfaces:**
- Consumes: `Director`, `FakeWorld` (Task 6); `StoryRunner`, `Gender`, `CAST`, `ENDINGS` (Task 4); `compileInk`,
  `listInk` (Task 3).
- Produces (Phase 2 dùng cho kịch bản thật, Phase 5 dùng để cân bằng):

```ts
export type Action = { pick: string } | { start: string } | 'pass';
export interface Report { endings: Record<string, number>; started: Set<string>; problems: string[] }
export function explore(json: string, opts: { runs: number; seed: number; maxActions: number }): Promise<Report>;
export interface Played { ending: string | null; problems: string[]; runner: StoryRunner; transcript: string[] }
export function playScript(json: string, gender: Gender, actions: Action[]): Promise<Played>;
```

Cả hai chạy `Director` thật với `FakeWorld` và một `UiPort` riêng; `ten = "Test"`. `transcript` là chữ của mọi dòng đã
hiện (không kèm tên người nói), theo thứ tự.
- `playScript`: `{ pick }` chọn lựa chọn đầu tiên không khóa có chữ bắt đầu bằng chuỗi đó; `{ start }` gọi
  `director.start`; `'pass'` gọi `director.passTime`. Hành động sai lúc (chọn khi đang tự do, `start` khi đang có lựa
  chọn), không tìm thấy lựa chọn, chọn trúng lựa chọn khóa, `start` bị từ chối, hay hết hành động trước khi tới kết
  thúc: ghi vấn đề và dừng, `ending` là `null`.
- `explore`: PRNG `mulberry32(seed)`. Lượt chẵn chơi `gioi_tinh = "nam"`, lượt lẻ `"nu"`. Lựa chọn: ngẫu nhiên trong
  các lựa chọn không khóa. Tự do: `'pass'` với xác suất 0.25 hoặc khi `available()` rỗng; còn lại `start` một truyện
  ngẫu nhiên trong `available()`.
- Vấn đề, ghi kèm số lượt và số hành động: `tinh_cam`, `nang_luc`, `gia_dinh`, `ban_be` ngoài 0–100; `buoi_ranh < 0`;
  `tien < 0`; `runner.errors()` khác rỗng; exception; dòng hiện ra còn tiền tố `^[a-z0-9_]+:` (mã người nói không có
  trong `CAST`); dòng dài quá 160 ký tự; mọi lựa chọn đều khóa; quá `maxActions` mà chưa tới kết thúc.

- [ ] **Step 1: Viết fixture và test fail.** `test/fixtures/buggy.ink`: `INCLUDE ../../story/lib/core.ink`,
  `-> chinh_tiep`, và knot `chinh_tiep` (`hub` trong core cần knot này) có hai lựa chọn; một cái đặt `~ tien = -5`, một
  cái có dòng `la: xin chào`; cả hai rồi đặt `ket_thuc` và `-> END`.

```ts
// test/explorer.test.ts
const slice = compileInk('test/fixtures/slice-main.ink').json!;
it('plays the two scripted slice paths', async () => {
  const a = await playScript(slice, 'nam', [{ pick: 'In lại bản màu' }, { start: 'c1_phu_vach_nuoc' }, { pick: 'Kéo Tú' }]);
  expect(a).toMatchObject({ ending: 'slice_gan', problems: [] });
  expect(a.runner.get('tinh_cam')).toBe(44);
  expect(a.transcript).toContain('Lần tới gặp, em ghi vào dòng này nhé. Em giữ một nửa tờ.');
  const b = await playScript(slice, 'nu', [{ pick: 'In bản đen trắng' }, { start: 'c1_hd_hoc' }, { pick: 'Chữa kỹ' }]);
  expect(b).toMatchObject({ ending: 'slice_xa', problems: [] });
  expect(b.transcript).toContain('Lần tới gặp, anh ghi vào dòng này nhé. Anh giữ một nửa tờ.');
});
it('reports picking a locked choice', async () => {
  const r = await playScript(slice, 'nam', [{ pick: 'Mời Khánh' }]);
  expect(r.ending).toBeNull(); expect(r.problems).toHaveLength(1);
});
it('explores the slice without problems', async () => {
  const r = await explore(slice, { runs: 200, seed: 1, maxActions: 50 });
  expect(r.problems).toEqual([]);
  expect(Object.keys(r.endings).sort()).toEqual(['slice_gan', 'slice_xa']);
  expect([...r.started].sort()).toEqual(['c1_hd_hoc', 'c1_phu_vach_nuoc']);
});
it('catches negative money and unknown speakers', async () => {
  const r = await explore(compileInk('test/fixtures/buggy.ink').json!, { runs: 20, seed: 1, maxActions: 20 });
  expect(r.problems.some((p) => p.includes('tien'))).toBe(true);
  expect(r.problems.some((p) => p.includes('la:'))).toBe(true);
});

// test/story.test.ts — kiểm chung cho story/main.ink; Phase 2 thêm lượt chơi viết sẵn của từng chương vào đây
const { json, errors, warnings } = compileInk('story/main.ink');
const SRC = listInk('story/main.ink').map((f) => f.text).join('\n');
const hasLocation = (id: string) => existsSync(`assets/locations/${id}`) || existsSync(`assets/greybox/${id}.glb`);
it('compiles cleanly', () => { expect(errors).toEqual([]); expect(warnings).toEqual([]); });
it('# den and # o point at existing locations', () => {
  for (const m of SRC.matchAll(/#\s*(?:den|o):\s*([a-z0-9_]+)/g)) if (m[1] !== 'dien_thoai') expect(hasLocation(m[1]), m[1]).toBe(true);
});
it('characters in # cam can_mat, # bieu_cam, # anim exist in CAST', () => { /* regex tương tự, so với khóa CAST */ });
it('every side or activity knot has mo_<knot>, # o and # ten', () => { /* runner.knots(/^c\d+_(phu|hd)_/) */ });
it('2000 random runs find no problems, reach exactly the ENDINGS and start every side knot', async () => {
  const r = await explore(json!, { runs: 2000, seed: 1, maxActions: 500 });
  expect(r.problems).toEqual([]);
  expect(Object.keys(r.endings).sort()).toEqual(Object.keys(ENDINGS).sort());
  // mọi knot c\d+_(phu|hd)_ đều có trong r.started
}, 60_000);
```

- [ ] **Step 2: Chạy `npx vitest run test/explorer.test.ts test/story.test.ts`.** Expected: FAIL, thiếu
  `test/explorer.ts`. Ca bối cảnh cũng FAIL vì chưa có `assets/greybox/`; Task 9 sinh file, nên tới lúc đó tạm
  `it.skip` riêng ca này.
- [ ] **Step 3: Implement `explore` và `playScript`** theo mô tả ở trên.
- [ ] **Step 4: Chạy lại.** Expected: PASS (trừ ca bối cảnh đang skip).
- [ ] **Step 5: Commit** `test(kira-game): automated story checks and explorer`.

### Task 8: Mức đồ họa

**Files:**
- Create: `kira-game/src/quality/tiers.ts`, `kira-game/src/quality/fps-monitor.ts`, `kira-game/src/quality/quality.ts`,
  `kira-game/src/quality/detect.ts`, `kira-game/tools/vendor.ts`
- Modify: `kira-game/package.json` (script `vendor: node tools/vendor.ts`; `predev` và `prebuild` chạy
  `npm run vendor && npm run story`)
- Test: `kira-game/test/quality.test.ts`

**Interfaces:**
- Consumes: `Quality` (Task 5).
- Produces:

```ts
export type Tier = 'thap' | 'vua' | 'cao';
export interface TierSettings { maxPixelRatio: number; textures: '1k' | '2k'; heroTextures: '1k' | '2k'; shadows: 'blob' | 'chars1024' | 'soft2048'; aa: 'none' | 'fxaa' | 'smaa'; post: boolean; maxNpcs: number }
export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  thap: { maxPixelRatio: 1.0, textures: '1k', heroTextures: '1k', shadows: 'blob',      aa: 'none', post: false, maxNpcs: 3 },
  vua:  { maxPixelRatio: 1.5, textures: '1k', heroTextures: '2k', shadows: 'chars1024', aa: 'fxaa', post: false, maxNpcs: 6 },
  cao:  { maxPixelRatio: 2.0, textures: '2k', heroTextures: '2k', shadows: 'soft2048',  aa: 'smaa', post: true,  maxNpcs: 10 },
};
export function initialTier(setting: Quality, gpuTier: number | null, isMobile: boolean): Tier;
export class FpsMonitor { constructor(thresholdFps: number); frame(nowMs: number, active: boolean): boolean }  // true = nên hạ
export class QualityManager {
  constructor(tier: Tier, isMobile: boolean, devicePixelRatio: number, monitor?: { frame(now: number, active: boolean): boolean });
  readonly tier: Tier; readonly pixelRatio: number; readonly settings: TierSettings;
  frame(nowMs: number, active: boolean): 'tier' | 'resolution' | null;
  set(tier: Tier): void;
}
export function gpuTierFrom(r: { type: string; tier: number }): number | null;
export function detectGpu(): Promise<{ tier: number | null; isMobile: boolean }>;
```

Quy tắc:
- `initialTier`: `setting` khác `'auto'` thì dùng luôn. `gpuTier` null → điện thoại `'thap'`, PC `'vua'`. Hạng 0–1 →
  `'thap'`, 2 → `'vua'`, 3 → `'cao'`. Điện thoại tối đa `'vua'`.
- `FpsMonitor.frame`: `!active`, đang trong thời gian nghỉ, hoặc khung trước cách quá 500 ms thì bắt đầu lại cửa sổ và
  trả `false`. Đủ 2000 ms thì tính FPS: dưới ngưỡng thì tăng đếm xấu, không thì về 0. Đếm xấu đạt 3 thì về 0, nghỉ
  10000 ms và trả `true`.
- `QualityManager`: ngưỡng 27 FPS nếu là điện thoại, ngược lại 50. Monitor báo hạ: chưa ở `thap` thì xuống một mức,
  `pixelRatio = min(dpr, maxPixelRatio)`, trả `'tier'`. Đang ở `thap` mà `pixelRatio > 0.6` thì giảm 0.2 (làm tròn một
  chữ số thập phân, không dưới 0.6), trả `'resolution'`. Còn lại trả `null`.
- `gpuTierFrom` (kết quả `getGPUTier` của detect-gpu): `type` `'BENCHMARK'` → `tier`; `'BLOCKLISTED'`,
  `'WEBGL_UNSUPPORTED'` → 0; `'FALLBACK'` (GPU lạ, thường là đời mới), `'SSR'` và còn lại → `null`.
- `detectGpu`: `getGPUTier({ benchmarksURL: import.meta.env.BASE_URL + 'vendor/benchmarks' })` (không có `/` cuối);
  lỗi → `tier: null`. `isMobile` lấy từ kết quả detect-gpu, không có thì `matchMedia('(pointer: coarse)').matches`.
- `tools/vendor.ts`: `cpSync` (recursive) `node_modules/three/examples/jsm/libs/basis/` sang `public/vendor/basis/`, và
  `node_modules/detect-gpu/dist/benchmarks/` (16 file JSON) sang `public/vendor/benchmarks/`. Basis chép ra để đặt
  đường dẫn transcoder rõ ràng ở Task 9; không dựa vào `import.meta.url` bên trong three, vì cách đó dễ hỏng khi Vite gom
  thư viện lúc chạy dev.

- [ ] **Step 1: Viết test fail**

```ts
// test/quality.test.ts (các ca cần có)
it.each([
  ['auto', 3, false, 'cao'], ['auto', 3, true, 'vua'], ['auto', 2, false, 'vua'], ['auto', 1, false, 'thap'],
  ['auto', null, true, 'thap'], ['auto', null, false, 'vua'], ['cao', 0, true, 'cao'],
])('initialTier(%s, %s, %s) = %s', (q, g, m, t) => expect(initialTier(q as Quality, g, m)).toBe(t));

it.each([
  [{ type: 'BENCHMARK', tier: 3 }, 3], [{ type: 'BLOCKLISTED', tier: 0 }, 0],
  [{ type: 'WEBGL_UNSUPPORTED', tier: 0 }, 0], [{ type: 'FALLBACK', tier: 1 }, null],
])('gpuTierFrom(%o) = %s', (r, t) => expect(gpuTierFrom(r)).toBe(t));

const feed = (m: FpsMonitor, fps: number, fromMs: number, toMs: number, active = true) => {
  const hits: number[] = []; for (let t = fromMs; t <= toMs; t += 1000 / fps) if (m.frame(t, active)) hits.push(t); return hits; };
it('downgrades after three slow windows, then waits for the cooldown', () => {
  const hits = feed(new FpsMonitor(50), 30, 0, 23_000);
  expect(hits[0]).toBeGreaterThanOrEqual(6000); expect(hits[0]).toBeLessThan(6200);
  expect(hits[1]).toBeGreaterThanOrEqual(22_000);
});
it('never downgrades at 60 fps', () => expect(feed(new FpsMonitor(50), 60, 0, 20_000)).toEqual([]));
it('ignores hidden time and a long loading hitch', () => {
  const m = new FpsMonitor(50);
  feed(m, 60, 0, 3000); feed(m, 1, 3000, 8000, false); m.frame(8900, true);   // khựng 900 ms
  expect(feed(m, 60, 8920, 20_000)).toEqual([]);
});
it('steps cao -> vua -> thap -> pixel ratio 0.8 -> 0.6 -> stop', () => {
  const q = new QualityManager('cao', false, 2, { frame: () => true });
  expect([q.frame(0, true), q.frame(0, true), q.frame(0, true), q.frame(0, true), q.frame(0, true)])
    .toEqual(['tier', 'tier', 'resolution', 'resolution', null]);
  expect(q.tier).toBe('thap'); expect(q.pixelRatio).toBe(0.6);
});
```

- [ ] **Step 2: Chạy `npx vitest run test/quality.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `tiers.ts`, `fps-monitor.ts`, `quality.ts`, `detect.ts`, `tools/vendor.ts`.**
- [ ] **Step 4: Chạy `npm test && npm run vendor`.** Expected: PASS; có `public/vendor/basis/basis_transcoder.wasm` và
  các file JSON trong `public/vendor/benchmarks/`.
- [ ] **Step 5: Commit** `feat(kira-game): adaptive quality tiers and fps monitor`.

### Task 9: Bối cảnh khối hộp, nạp bối cảnh, cách bày, va chạm

**Files:**
- Create: `kira-game/tools/greybox.ts`, `kira-game/src/assets.ts`, `kira-game/src/world/location.ts`,
  `kira-game/src/world/collision.ts`, `kira-game/assets/LICENSES.md`, `kira-game/assets/greybox/tiem_photo.glb`,
  `kira-game/assets/greybox/lop_hoc.glb` (hai file sinh bằng tool)
- Modify: `kira-game/package.json` (script `greybox: node tools/greybox.ts`), `kira-game/test/story.test.ts` (bỏ
  `it.skip` của ca bối cảnh)
- Test: `kira-game/test/location.test.ts`, `kira-game/test/collision.test.ts`

**Interfaces:**
- Consumes: `TierSettings['textures']` (Task 8).
- Produces:

```ts
// tools/greybox.ts
export type V3 = [number, number, number];
export interface GreyBox { name: string; size: V3; at: V3 }          // at = tâm hộp, mét
export interface GreyboxSpec { floor: [number, number]; boxes: GreyBox[]; anchors: Record<string, V3>; variants?: Record<string, GreyBox[]> }
export const GREYBOX: Record<string, GreyboxSpec>;                     // Phase 2 thêm bối cảnh vào bảng này
export function buildGreybox(spec: GreyboxSpec): Document;            // @gltf-transform/core
// src/assets.ts — import.meta.glob('../assets/**/*.{glb,ktx2,png,jpg,mp3}', { query: '?url', import: 'default', eager: true })
export function assetUrl(path: string): string;   // path tính từ assets/; thiếu -> throw new Error('Thiếu asset: ' + path)
export function hasAsset(path: string): boolean;
// src/world/location.ts
export interface Anchors { spawns: Map<string, Object3D>; npcs: Map<string, Object3D>; points: Map<string, Object3D>; cams: Map<string, Object3D>; colliders: Mesh[] }
export function extractAnchors(root: Object3D): Anchors;              // theo tiền tố spawn_/npc_/diem_/cam_/collider_; collider đặt visible = false
export function applyVariant(root: Object3D, variant: string | null): void;  // nhóm bt_<variant> hiện, mọi nhóm bt_ khác ẩn
export function activeColliders(colliders: Mesh[]): Mesh[];           // bỏ collider có tổ tiên đang ẩn (nằm trong nhóm bt_ bị ẩn)
export function locationPath(id: string, textures: '1k' | '2k', has: (path: string) => boolean): string;
// locations/<id>/<id>-<textures>.glb -> bộ texture còn lại -> greybox/<id>.glb -> throw new Error('Thiếu bối cảnh: ' + id)
export function loadLocation(renderer: WebGLRenderer, id: string, textures: '1k' | '2k'): Promise<{ scene: Group; anchors: Anchors }>;
// src/world/collision.ts
export function buildCollider(meshes: Mesh[]): MeshBVH;
export function pushOut(bvh: MeshBVH, start: Vector3, end: Vector3, radius: number): Vector3;  // độ dời để capsule không còn xuyên mesh
```

Bảng `GREYBOX` của Phase 1 (đơn vị mét; tọa độ chỉ là gợi ý, test chỉ kiểm tên node):

| Mã | Sàn (rộng × sâu) | Hộp: tên, cỡ, tâm | Điểm neo | Cách bày |
|---|---|---|---|---|
| `tiem_photo` | 6 × 10 | `quay` 3×1×0.6 tại (0, 0.5, −2); `may_photo` 1×1.2×0.8 tại (−2, 0.6, −4); `ke_giay` 0.5×2×2 tại (2.7, 1, −3) | `spawn_mac_dinh` (0, 0, 3); `npc_ny` (1, 0, 1); `npc_me` (−1, 0, −3); `diem_bac_cua` (0, 0, 4.5); `cam_toan_canh` (2.6, 2.7, −4.6) | `tet`: `cau_doi` 0.3×1.5×0.05 tại (−1, 1.6, −4.95); `mam_qua` 0.8×0.3×0.6 tại (1, 1.15, −2) |
| `lop_hoc` | 9 × 7 | `bang` 4×1.2×0.1 tại (0, 1.5, −3.4); `ban_1` … `ban_4` 1.2×0.75×0.5 tại (±1.5, 0.375, −1) và (±1.5, 0.375, 0.5) | `spawn_mac_dinh` (0, 0, 2.5); `npc_ny` (−1.5, 0, −0.4); `npc_tu` (1.5, 0, −0.4); `diem_ban_hoc` (1.5, 0, 1); `cam_toan_canh` (4.2, 2.7, −3.2) | — |

`buildGreybox`:
- Sàn `san` dày 0.2 m, mặt trên ở y = 0. Bốn tường `tuong_1` … `tuong_4` cao 3 m, dày 0.2 m, nằm ngoài mép sàn.
- Mỗi hộp (kể cả sàn, tường) là một node có mesh, cộng một node `collider_<tên>` dùng chung mesh đó.
- Hộp của cách bày nằm trong node nhóm `bt_<cach_bay>`.
- Điểm neo là node rỗng.
- Màu phẳng theo vai trò: sàn xám, tường sáng, đồ vật xám xanh, đồ của cách bày đỏ.
- Đỉnh, pháp tuyến, chỉ số lấy từ `new BoxGeometry(...)` của three (chạy được trong Node). Phải gọi `doc.createBuffer()`
  trước khi tạo accessor.
- Chạy trực tiếp (`process.argv[1]` trùng file này) thì ghi mọi bối cảnh trong bảng ra `assets/greybox/<mã>.glb` bằng
  `NodeIO`. Import từ test thì không ghi gì.

`loadLocation`: `GLTFLoader` với `KTX2Loader` (`setTranscoderPath(import.meta.env.BASE_URL + 'vendor/basis/')`,
`detectSupport(renderer)`) và `setMeshoptDecoder(MeshoptDecoder)` (`import { MeshoptDecoder } from
'three/addons/libs/meshopt_decoder.module.js'`). Mỗi loader tạo một lần. Đường dẫn file theo `locationPath(…, hasAsset)`.
Khối hộp không có texture hay nén; hai loader này chạy thật lần đầu ở bản thử phong cách của `docs/plan-art.md`.

`buildCollider`: lấy riêng thuộc tính `position` của từng mesh, nhân `matrixWorld`, gộp bằng `mergeGeometries`
(`three/addons/utils/BufferGeometryUtils.js`), rồi `new MeshBVH(gộp)`. Không dùng `StaticGeometryGenerator`: nó chỉ duyệt
mesh đang hiện (`traverseVisible`), mà collider luôn bị ẩn. `pushOut` theo ví dụ `characterMovement` của three-mesh-bvh,
viết theo API 0.10:
- `bvh.shapecast({ intersectsBounds: (box) => box.intersectsBox(hộp bao capsule), intersectsTriangle: (tri) => … })`.
- Trong `intersectsTriangle`: `tri.closestPointToSegment(đoạn, điểmTrênTamGiác, điểmTrênĐoạn)` trả khoảng cách; nhỏ
  hơn bán kính thì đẩy đoạn ra theo hướng `điểmTrênĐoạn − điểmTrênTamGiác`.

- [ ] **Step 1: Viết test fail**

```ts
// test/location.test.ts (các ca cần có)
it('extracts anchors by name prefix and hides colliders', /* Group có spawn_a, npc_b, diem_c, cam_d, collider_e (Mesh) -> đúng map; collider.visible === false */);
it('shows only the requested bt_ group', /* bt_tet, bt_tiem_in: applyVariant(root, 'tet') -> chỉ bt_tet hiện; applyVariant(root, null) -> cả hai ẩn */);
it('drops colliders inside hidden groups', /* collider trong bt_tiem_in đang ẩn bị bỏ; collider tự ẩn nhưng tổ tiên hiện thì giữ */);
it('prefers the real location, then the other texture set, then greybox', () => {
  const has = (p: string) => ['locations/a/a-1k.glb', 'greybox/b.glb'].includes(p);
  expect(locationPath('a', '1k', has)).toBe('locations/a/a-1k.glb');
  expect(locationPath('a', '2k', has)).toBe('locations/a/a-1k.glb');
  expect(locationPath('b', '2k', has)).toBe('greybox/b.glb');
  expect(() => locationPath('c', '1k', has)).toThrow('Thiếu bối cảnh: c');
});
it('generated greybox files carry the slice anchors', async () => {
  const want = { tiem_photo: ['spawn_mac_dinh', 'npc_ny', 'npc_me', 'diem_bac_cua', 'cam_toan_canh', 'bt_tet', 'collider_quay', 'collider_san'],
                 lop_hoc: ['spawn_mac_dinh', 'npc_ny', 'npc_tu', 'diem_ban_hoc', 'cam_toan_canh', 'collider_ban_1'] };
  for (const [id, nodes] of Object.entries(want)) {
    const names = (await new NodeIO().read(`assets/greybox/${id}.glb`)).getRoot().listNodes().map((n) => n.getName());
    for (const n of nodes) expect(names, `${id}/${n}`).toContain(n);
  }
});
// test/collision.test.ts
it('pushes a capsule out of a wall', () => {
  const wall = new Mesh(new BoxGeometry(0.2, 3, 10)); wall.position.set(1, 1.5, 0); wall.updateMatrixWorld();
  const d = pushOut(buildCollider([wall]), new Vector3(0.8, 0.3, 0), new Vector3(0.8, 1.4, 0), 0.3);
  expect(0.8 + d.x).toBeLessThanOrEqual(0.6 + 1e-3);
});
it('still collides when the collider mesh is hidden', /* như trên với wall.visible = false */);
it('leaves a free capsule alone', /* capsule tại x = 0 -> độ dời ~ (0, 0, 0) */);
```

- [ ] **Step 2: Chạy `npx vitest run test/location.test.ts test/collision.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `tools/greybox.ts`, chạy `npm run greybox`; implement `assets.ts`, `location.ts`,
  `collision.ts`; tạo `assets/LICENSES.md`** (bảng: Asset | Nguồn | Giấy phép | Ghi công | Ngày lấy; dòng khối hộp: tự
  tạo).
- [ ] **Step 4: Bỏ `it.skip` ở ca bối cảnh của `test/story.test.ts`; chạy `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): greybox locations, anchors, variants and capsule collision`.

### Task 10: Điều khiển và di chuyển

**Files:**
- Create: `kira-game/src/input/keyboard.ts`, `kira-game/src/input/joystick.ts`, `kira-game/src/world/player.ts`
- Test: `kira-game/test/input.test.ts`, `kira-game/test/player.test.ts`

**Interfaces:**
- Consumes: `buildCollider`, `pushOut` (Task 9).
- Produces:

```ts
export interface Vec2 { x: number; y: number }
export function keysToVector(down: ReadonlySet<string>): Vec2;  // KeyboardEvent.code: KeyW/ArrowUp y+1, KeyS/ArrowDown y−1, KeyA/ArrowLeft x−1, KeyD/ArrowRight x+1; không chuẩn hóa
export function joystickVector(origin: Vec2, pointer: Vec2, radius: number): Vec2;  // tọa độ màn hình (y hướng xuống) -> y dương là đi tới; độ dài kẹp ≤ 1
export class Keyboard { constructor(target: Window); readonly down: Set<string>; interact(): boolean; menu(): boolean; dispose(): void }  // interact = E hoặc Space, menu = Escape; mỗi lần bấm chỉ trả true một lần
export class Joystick { constructor(container: HTMLElement); readonly value: Vec2; dispose(): void }  // pointer events ở nửa trái; vòng tròn hiện tại chỗ chạm, bán kính 60 px
export function moveDelta(input: Vec2, yaw: number, speed: number, dt: number): Vector3;  // mặt XZ; độ dài input kẹp ≤ 1; yaw 0 nhìn về −Z
export class PlayerController {
  constructor(bvh: MeshBVH, spawn: Object3D);
  readonly position: Vector3;   // vị trí bàn chân
  update(input: Vec2, yaw: number, dt: number): void;  // đi 2.2 m/s; capsule bán kính 0.3 m, cao 1.7 m; trọng lực 9.8 m/s²; pushOut mỗi khung; dt kẹp ≤ 0.1
}
```

- [ ] **Step 1: Viết test fail**

```ts
// test/input.test.ts
expect(keysToVector(new Set(['KeyW', 'KeyD']))).toEqual({ x: 1, y: 1 });
expect(keysToVector(new Set(['ArrowUp', 'ArrowDown']))).toEqual({ x: 0, y: 0 });
expect(joystickVector({ x: 100, y: 100 }, { x: 100, y: 50 }, 50)).toEqual({ x: 0, y: 1 });
expect(Math.hypot(...Object.values(joystickVector({ x: 0, y: 0 }, { x: 300, y: 400 }, 50)))).toBeCloseTo(1);
// test/player.test.ts
it('moves forward along -Z at yaw 0 and -X at yaw π/2', () => {
  expect(moveDelta({ x: 0, y: 1 }, 0, 2, 0.5).toArray().map((v) => +v.toFixed(6))).toEqual([0, 0, -1]);
  expect(moveDelta({ x: 0, y: 1 }, Math.PI / 2, 2, 0.5).toArray().map((v) => +v.toFixed(6))).toEqual([-1, 0, 0]);
});
it('does not move faster diagonally', () => expect(moveDelta({ x: 1, y: 1 }, 0, 2, 0.5).length()).toBeCloseTo(1));
it('stands on the floor and stops at the wall', () => {
  // sàn hộp 20×0.2×20 (mặt trên y = 0) + tường tại x = 1 (dày 0.2); spawn (0, 0, 0)
  // 120 khung dt 1/60, input { x: 1, y: 0 }, yaw 0
  expect(player.position.x).toBeLessThanOrEqual(0.6 + 1e-3);
  expect(Math.abs(player.position.y)).toBeLessThan(0.05);
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL.**
- [ ] **Step 3: Implement `keyboard.ts`, `joystick.ts`, `player.ts`.**
- [ ] **Step 4: Chạy `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): keyboard, touch joystick and player movement`.

### Task 11: Nhân vật, biểu cảm, camera

**Files:**
- Create: `kira-game/src/world/characters.ts`, `kira-game/src/world/camera-rig.ts`,
  `kira-game/assets/characters/robot/robot.glb` (tải về)
- Modify: `kira-game/src/story/cast.ts` (thêm thông tin mô hình), `kira-game/assets/LICENSES.md`
- Test: `kira-game/test/characters.test.ts`, `kira-game/test/camera.test.ts`

**Interfaces:**
- Consumes: `CameraPreset` (Task 6); `Anchors` (Task 9); `Gender`, `CAST` (Task 4).
- Produces:

```ts
// cast.ts (thêm)
export interface ModelInfo { file: string; scale: number; clips: Record<string, string>; expressions: Record<string, string> }
export const MODELS: Record<string, ModelInfo>;
// Phase 1 chỉ có robot = { file: 'characters/robot/robot.glb', scale: <đo bằng Box3 để cao ~1.7 m>,
//   clips: { dung: 'Idle', di: 'Walking', chay: 'Running', ngoi: 'Sitting', vay_tay: 'Wave', gat_dau: 'Yes', lac_dau: 'No' },
//   expressions: { gian: 'Angry', ngac_nhien: 'Surprised', buon: 'Sad' } }
// CastEntry thêm `model: string | Record<Gender, string>` (khóa là giới tính NGƯỜI CHƠI; Phase 4 dùng cho toi_nam/toi_nu, ny_nu/ny_nam).
// Phase 1 mọi nhân vật dùng 'robot'.
export function modelOf(id: string, playerGender: Gender): ModelInfo | null;  // id không có trong CAST -> null
// characters.ts
export function resolveName(map: Record<string, string>, name: string): string | null;
export class CharacterRig {
  constructor(src: { scene: Object3D; animations: AnimationClip[] }, info: ModelInfo);  // clone bằng SkeletonUtils.clone
  readonly root: Object3D;
  play(clip: string, fadeSec?: number): void;  // mặc định 0.25; tên không có trong map -> console.warn một lần, bỏ qua
  expression(name: string): void;              // morph tương ứng = 1, morph biểu cảm khác = 0; 'binh_thuong' -> tất cả 0
  update(dt: number): void;
}
// camera-rig.ts
export function orbitPosition(target: Vector3, yaw: number, pitch: number, distance: number): Vector3;
//   = target + (sin(yaw)·d·cos(pitch), d·sin(pitch), cos(yaw)·d·cos(pitch))
export interface Shot { pos: Vector3; look: Vector3 }
export function presetShot(p: CameraPreset, ctx: { cams: Map<string, Object3D>; actors: Map<string, Object3D>; player: Object3D; speaker: string | null }): Shot | null;
//   toan_canh: pos = cam_toan_canh (không có thì player + (0, 4, 6)), look = player + (0, 1, 0)
//   can_mat <nv>: 'toi' là player; nhân vật chưa có -> null; pos = nhân vật + hướng mặt × 0.9 + (0, 1.55, 0), look = nhân vật + (0, 1.5, 0)
//   qua_vai: speaker là nhân vật đã có -> pos = player + (0, 1.6, 0) − hướng(player→speaker) × 1.0 + bên phải × 0.4, look = speaker + (0, 1.5, 0); không có -> null
//   hướng mặt = trục +Z của nhân vật (mô hình glTF nhìn về +Z)
export class CameraRig {
  constructor(camera: PerspectiveCamera);
  setCollider(bvh: MeshBVH | null): void;
  readonly yaw: number;
  drag(dxPx: number, dyPx: number): void;      // 0.005 rad/px; pitch kẹp [−0.2, 0.9]
  follow(target: Vector3): void;               // chế độ theo sau: cách 3.2 m, nhìn điểm cao 1.6 m; raycastFirst từ đó tới camera, chạm thì đặt camera trước điểm chạm 0.2 m
  shot(s: Shot, reduceMotion: boolean): void;  // chuyển mượt 0.4 s; reduceMotion thì tức thì
  update(dt: number): void;
}
```

- [ ] **Step 1: Tải nhân vật tạm và ghi bản quyền.** Đọc `examples/models/gltf/RobotExpressive/README.md` ở tag `r187`
  của repo three.js để xác nhận giấy phép CC0, rồi tải
  `https://raw.githubusercontent.com/mrdoob/three.js/r187/examples/models/gltf/RobotExpressive/RobotExpressive.glb` về
  `assets/characters/robot/robot.glb`. Thêm dòng vào `LICENSES.md`: RobotExpressive, Tomás Laulhé (Quaternius), chỉnh
  sửa bởi Don McCurdy, CC0 1.0.
- [ ] **Step 2: Viết test fail**

```ts
// test/characters.test.ts — mesh tự dựng có morphTargetDictionary { Angry: 0, Surprised: 1, Sad: 2 }
it('maps expressions to morph targets', () => {
  rig.expression('gian'); expect(mesh.morphTargetInfluences).toEqual([1, 0, 0]);
  rig.expression('buon'); expect(mesh.morphTargetInfluences).toEqual([0, 0, 1]);
  rig.expression('binh_thuong'); expect(mesh.morphTargetInfluences).toEqual([0, 0, 0]);
});
it('ignores unknown expressions and clips with one warning', /* expression('cuoi') hai lần -> warn 1 lần, influences không đổi */);
it('plays a mapped clip', /* AnimationClip 'Wave' tự dựng; play('vay_tay'); update(0.1) -> action đang chạy */);
it('picks the model by cast entry', /* modelOf('ny', 'nam') === MODELS.robot; modelOf('la', 'nam') === null */);
// test/camera.test.ts
it('orbits behind the target', () => {
  expect(orbitPosition(new Vector3(0, 1.6, 0), 0, 0, 3.2).toArray()).toEqual([0, 1.6, 3.2]);
  const p = orbitPosition(new Vector3(0, 1.6, 0), Math.PI / 2, 0, 3.2); expect(p.x).toBeCloseTo(3.2); expect(p.z).toBeCloseTo(0);
});
it('frames a face from the front', /* actor ny ở gốc nhìn +Z: can_mat ny -> pos (0, 1.55, 0.9), look (0, 1.5, 0); can_mat tu (chưa có) -> null */);
it('falls back for toan_canh without an anchor', /* cams rỗng, player ở (1, 0, 1) -> pos (1, 4, 7), look (1, 1, 1) */);
it('pulls the camera in front of a wall', /* tường giữa target và vị trí camera -> camera cách mặt tường 0.2 m về phía target */);
```

- [ ] **Step 3: Chạy, xác nhận FAIL; implement `characters.ts`, `camera-rig.ts`, phần mô hình trong `cast.ts`; chạy
  lại.** Expected: PASS.
- [ ] **Step 4: Commit** `feat(kira-game): character rig, expressions and camera rig`.

### Task 12: World, renderer, ánh sáng, điểm tương tác

**Files:**
- Create: `kira-game/src/world/renderer.ts`, `kira-game/src/world/lighting.ts`, `kira-game/src/world/interactables.ts`,
  `kira-game/src/world/world.ts`
- Test: `kira-game/test/interactables.test.ts`, `kira-game/test/lighting.test.ts`

**Interfaces:**
- Consumes: `WorldPort`, `Marker`, `CameraPreset` (Task 6); `Place` (Task 5); `QualityManager`, `TierSettings`
  (Task 8); `loadLocation`, `applyVariant`, `activeColliders`, `buildCollider` (Task 9); `PlayerController`,
  `Keyboard`, `Joystick`, `keysToVector` (Task 10); `CharacterRig`, `CameraRig`, `presetShot`, `modelOf` (Task 11).
- Produces:

```ts
// renderer.ts
export function hasWebGL2(): boolean;
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer;  // antialias false, powerPreference 'high-performance', SRGB, AgXToneMapping
export class RenderPipeline {
  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera);
  apply(s: TierSettings, pixelRatio: number): void;  // pixel ratio, shadow map, dựng lại chuỗi pass
  setSize(width: number, height: number): void;
  render(): void;
}
// lighting.ts
export interface LightPreset { sky: number; ground: number; hemiIntensity: number; sun: number; sunIntensity: number; sunDir: [number, number, number]; background: number }
export const LIGHTING: Record<string, LightPreset>;  // ngay, chieu, toi
export function lightingFor(id: string): LightPreset; // id lạ -> console.warn, trả LIGHTING.ngay
// interactables.ts
export interface Interactable { marker: Marker; anchor: Object3D }
export function nearest(player: Vector3, items: Interactable[], maxDist?: number): Interactable | null;  // khoảng cách trên mặt XZ, mặc định 1.8 m
// world.ts
export class World implements WorldPort {
  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, quality: QualityManager, playerGender: Gender, hooks: {
    onPrompt(marker: Marker | null): void;   // hiện/ẩn nút tương tác với nhãn của dấu
    onInteract(knot: string): void;          // E/Space hoặc nút tương tác
    onQuality(change: 'tier' | 'resolution'): void;
    onFps(fps: number): void;                // 2 lần/giây
  });
  start(): void;                              // vòng requestAnimationFrame
  setReduceMotion(on: boolean): void;
  applyQuality(): void;                       // gọi sau khi đổi mức trong Cài đặt
}
```

Chuỗi pass của `RenderPipeline`: `thap` gọi thẳng `renderer.render`; `vua` dùng `RenderPass`, `FXAAPass`, `OutputPass`;
`cao` dùng `RenderPass`, `GTAOPass`, `UnrealBloomPass` (nhẹ), `SMAAPass`, `OutputPass`. Ở three 0.187, `FXAAPass()` và
`SMAAPass()` không nhận tham số. Bóng: `thap` tắt shadow map (World vẽ bóng giả); `vua` bật, map 1024, chỉ nhân vật đổ
bóng; `cao` bóng mềm, map 2048.

Hành vi của `World`:
- `goTo(place)`: mờ `overlay` (bỏ qua khi giảm chuyển động), giải phóng bối cảnh cũ (geometry, material, texture; không
  đụng mô hình nhân vật gốc), xóa NPC, nạp bối cảnh theo `quality.settings.textures`, `applyVariant(place.variant)`,
  dựng va chạm từ `activeColliders`, áp `lightingFor(place.lighting)`, đặt người chơi ở `spawn_mac_dinh` (hoặc spawn
  đầu tiên), rồi hiện lại.
- Nhân vật được dựng khi cần: dấu ở neo `npc_<mã>`, hoặc mã đó xuất hiện trong `speaking`, `camera`, `expression`,
  `anim`. Dựng tại neo `npc_<mã>` (không có neo thì cảnh báo, bỏ qua), quay mặt về người chơi, mô hình theo
  `modelOf(mã, playerGender)`. `'toi'` là nhân vật người chơi.
- `markers`: dấu "!" nổi (sprite) trên mỗi neo; danh sách cho `nearest`.
- `speaking(who)`: ghi nhớ người đang nói cho `qua_vai`. `camera(p)`: `presetShot(...)` khác `null` thì
  `cameraRig.shot(...)`, ngược lại giữ góc hiện tại.
- `freeRoam(on)`: bật/tắt điều khiển; bật thì camera theo sau và có lời nhắc tương tác.
- Mỗi khung: input → người chơi (chỉ khi tự do) → camera → nhân vật → render →
  `quality.frame(now, !đangTải && document.visibilityState === 'visible')`. Mức `thap` vẽ đĩa mờ dưới chân nhân vật.
- Ba kiểu ánh sáng là màu và cường độ do người làm chọn. Ngày: trời trắng sáng. Chiều: nắng vàng thấp. Tối: đèn ấm,
  nền tối. Lightmap thật đến ở Phase 3–4.

- [ ] **Step 1: Viết test fail**

```ts
// test/interactables.test.ts
it('picks the closest item within range, ignoring height', /* 2 item cách 1.0 m và 1.5 m (một cái cao hơn 2 m) -> cái 1.0 m */);
it('returns null when nothing is within 1.8 m', /* item cách 2.0 m -> null */);
// test/lighting.test.ts
it('falls back to day light with a warning', /* lightingFor('khong_co') === LIGHTING.ngay; console.warn được gọi */);
```

- [ ] **Step 2: Chạy, xác nhận FAIL; implement `interactables.ts`, `lighting.ts`; chạy lại.** Expected: PASS.
- [ ] **Step 3: Implement `renderer.ts` và `world.ts`.** Chạy `npm test && npm run typecheck`. Expected: PASS. Xem
  trên trình duyệt ở Task 14.
- [ ] **Step 4: Commit** `feat(kira-game): three.js world implementing the world port`.

### Task 13: Giao diện DOM

**Files:**
- Create: `kira-game/src/ui/dialogue.ts`, `kira-game/src/ui/title.ts`, `kira-game/src/ui/hud.ts`,
  `kira-game/src/ui/settings.ts`, `kira-game/src/ui/styles.css`
- Modify: `kira-game/index.html` (khung UI, lớp phủ xoay ngang, thông báo thiếu WebGL2)
- Test: `kira-game/test/ui.test.ts` (dòng đầu `// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes: `ShownLine`, `Settings`, `DEFAULT_SETTINGS` (Task 5); `validateName` (Task 2); `Gender`, `Choice`
  (Task 4); `HudState`, `Marker` (Task 6).
- Produces:

```ts
export class DialogueBox {
  constructor(root: HTMLElement, settings: () => Settings);
  line(l: ShownLine): Promise<void>;             // chữ chạy theo textSpeed ký tự/giây; lần chạm/Space/Enter đầu hiện hết, lần sau sang dòng
  choose(choices: Choice[]): Promise<number>;   // <button>; lựa chọn khóa có disabled và biểu tượng khóa; phím 1–9 theo thứ tự hiện, bỏ qua lựa chọn khóa;
                                                // resolve đúng một lần, sau đó mọi click/phím bị bỏ qua tới lần gọi kế
  history(): readonly ShownLine[];              // 50 dòng gần nhất
  hide(): void;
}
// Nút: Tự động (chờ 1.2 s + 50 ms mỗi ký tự rồi sang dòng), Bỏ qua (tua tới lựa chọn kế tiếp), Lịch sử. Tin nhắn (message: true) có kiểu khung riêng.
export function showTitle(root: HTMLElement, opts: { hasSave: boolean }): Promise<'continue' | 'new' | 'settings' | 'credits' | 'endings'>;
export function showNewGame(root: HTMLElement): Promise<{ name: string; gender: Gender }>;  // lỗi validateName hiện dưới ô nhập (aria-live="polite")
export function chapterCard(root: HTMLElement, text: string): Promise<void>;
export function endingScreen(root: HTMLElement, title: string, summary: string): Promise<void>;
export class Hud {
  constructor(root: HTMLElement);
  set(h: HudState | null): void;           // "Chương 1 · Lớp 10 · Tháng mười", "Còn 1 buổi rảnh"; null ẩn các nút của chế độ tự do
  toast(text: string): void;               // tự ẩn sau 3 s
  prompt(label: string | null, onTap: () => void): void;  // nút tương tác mang nhãn của dấu, ví dụ "Đo lại vạch nước"
  fps(v: number | null): void;
  onPassTime(cb: () => void): void;        // nút "Để thời gian trôi" (chỉ hiện ở tự do)
  onPhone(cb: (knot: string) => void): void;  // nút "Điện thoại" mở <dialog> liệt kê HudState.phone theo nhãn
  onMenu(cb: () => void): void;
}
export function openSettings(root: HTMLElement, current: Settings): Promise<Settings>;  // <dialog>: Đồ họa (Tự động/Thấp/Vừa/Cao), Hiện FPS, Tốc độ chữ, Cỡ chữ, Giảm chuyển động
```

CSS: font hệ thống đủ dấu tiếng Việt (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`). Lớp phủ xoay ngang
chỉ hiện với `@media (orientation: portrait) and (pointer: coarse)`. Chữ trong khung thoại nhân với `fontScale`. Hộp
"Điện thoại" của Phase 1 chỉ là danh sách; Phase 3 thay bằng điện thoại đủ bốn mục.

- [ ] **Step 1: Viết test fail**

```ts
// test/ui.test.ts — dòng đầu: // @vitest-environment happy-dom
it('renders speaker and text as plain text', async () => {
  const box = new DialogueBox(root, () => ({ ...DEFAULT_SETTINGS, textSpeed: 10_000 }));
  const done = box.line({ speakerId: null, speaker: '<b>x</b>', text: '<img src=x onerror=alert(1)>', message: false });
  click(root); click(root); await done;
  expect(root.querySelector('img')).toBeNull();
  expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
});
it('resolves a choice once even on double click and key press', async () => {
  const p = box.choose([{ text: 'A', locked: false }, { text: 'B', locked: false }]);
  const [, b] = root.querySelectorAll('button.choice'); (b as HTMLElement).click(); (b as HTMLElement).click(); press('1');
  expect(await p).toBe(1);
  const q = box.choose([{ text: 'C', locked: false }]); let settled = false; q.then(() => (settled = true));
  await Promise.resolve(); expect(settled).toBe(false);
});
it('never resolves a locked choice', async () => {
  const p = box.choose([{ text: 'A', locked: false }, { text: 'B · 10 nghìn', locked: true }]);
  let settled = false; p.then(() => (settled = true));
  const [, b] = root.querySelectorAll('button.choice');
  expect((b as HTMLButtonElement).disabled).toBe(true);
  (b as HTMLElement).click(); press('2'); await Promise.resolve(); expect(settled).toBe(false);
  press('1'); expect(await p).toBe(0);
});
it('new game shows the name error and resolves with a valid name', async () => {
  const p = showNewGame(root);
  type('   '); clickStart(); expect(root.textContent).toContain('Hãy nhập tên.');
  type('Hào'); clickGender('Nữ'); clickStart();
  expect(await p).toEqual({ name: 'Hào', gender: 'nu' });
});
it('settings returns the edited values', /* đổi Đồ họa sang Thấp, bật Hiện FPS, Lưu -> { quality: 'thap', showFps: true, … } */);
it('lists phone stories by label', /* hud.set({ …, phone: [c1_hd_hoc 'Ôn bài với Khánh'] }); bấm Điện thoại, bấm nhãn -> onPhone('c1_hd_hoc') */);
```

  happy-dom phát sự kiện `close` của `<dialog>` đồng bộ; test không dựa vào thứ tự của sự kiện này.
- [ ] **Step 2: Chạy `npx vitest run test/ui.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement các file UI và sửa `index.html`.**
- [ ] **Step 4: Chạy `npm test && npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): dialogue, title, hud and settings ui`.

### Task 14: Ghép nối và nghiệm thu bản thử

**Files:**
- Modify: `kira-game/src/main.ts`
- Create: `kira-game/docs/perf.md` (số đo thật)

**Interfaces:**
- Consumes: mọi thứ ở Task 1–13.

Luồng `main.ts`:
1. `hasWebGL2()` sai thì hiện thông báo (Global Constraints) và dừng.
2. `store = new SaveStore(storageOrNull())`. `store.available` sai thì toast "Không lưu được tiến trình trên trình
   duyệt này." một lần, sau khi hiện màn hình chính.
3. `profile = store.profile()`, `gpu = await detectGpu()`,
   `quality = new QualityManager(initialTier(profile.settings.quality, gpu.tier, gpu.isMobile), gpu.isMobile, devicePixelRatio)`.
   `onQuality('tier')` thì toast "Đã giảm đồ họa cho mượt hơn". Cửa sổ đổi cỡ thì cập nhật camera và `RenderPipeline`.
4. Kịch bản: `import storyText from './story/story.gen.json?raw'`, `storyVersion = fnv1a(storyText)`. `UiPort` ghép từ
   `DialogueBox` (`line`, `choose`), `chapterCard`, `endingScreen` (tên và tóm tắt lấy từ `ENDINGS`; id lạ thì dùng chính
   id) và `Hud` (`hud`, `toast`).
5. Màn hình chính:
   - **Chơi mới:** `showNewGame` → tạo `World` với giới tính đã chọn, `world.start()` → `StoryRunner`, đặt `ten` và
     `gioi_tinh` → `store.clear()` → `writeCheckpoint` chương 1 → `Director` → vòng chơi.
   - **Tiếp tục:** tạo `World` theo `save.gender`, rồi `resume(...)`.
     - `exact`: `director.place = save.place`, `director.lastLine = save.lastLine`; `await world.goTo(save.place)` nếu
       có; có `lastLine` thì hiện lại câu đó trước khi chạy tiếp.
     - `checkpoint`: toast "Game vừa cập nhật, bạn chơi tiếp từ đầu chương N.".
     - `none`: toast "Không mở được bản lưu cũ, bắt đầu lại từ đầu." rồi sang Chơi mới.
   - **Cài đặt:** `openSettings` → `writeProfile`; mức đồ họa khác `auto` thì `quality.set(...)` và
     `world.applyQuality()`.
   - **Giới thiệu & bản quyền:** nội dung `assets/LICENSES.md` (import `?raw`) trong `<pre>`, gán qua `textContent`.
   - **Kết thúc đã mở:** liệt kê tên và tóm tắt từ `ENDINGS` theo `profile.endings`.
6. Vòng chơi: `await director.run()`. Ở tự do, chờ đúng một trong bốn rồi gỡ mọi listener:
   - tương tác (`director.start(knot)`);
   - chọn truyện trong hộp Điện thoại (`director.start(knot)`);
   - "Để thời gian trôi" (`director.passTime()`);
   - menu (Tiếp tục / Cài đặt / Về màn hình chính).

   Khi `'ended'` thì về màn hình chính.
7. `persist`:
   - `progress`: `store.write` với `runner.saveState()`, `director.place`, `chapter = chuong`, `director.lastLine`.
   - `chapter`: `writeCheckpoint({ chapter, storyVersion, ink, vars })`, ghi save, thêm chương vừa xong vào
     `profile.chaptersDone`.
   - `ending`: thêm vào `profile.endings` (không trùng), `store.clear()`.

- [ ] **Step 1: Implement `main.ts`** theo luồng trên.
- [ ] **Step 2: Chạy `npm test && npm run typecheck`.** Expected: PASS.
- [ ] **Step 3: Nghiệm thu trên trình duyệt** (cần chủ dự án cho phép chạy `npm run dev`). Đi hết danh sách "Nghiệm thu
  Phase 1" và ghi kết quả.
- [ ] **Step 4: Ghi số đo vào `docs/perf.md`:**
  - FPS theo từng mức trên từng máy;
  - thời gian tới màn hình chính;
  - JS tải lúc đầu (gzip) sau `npm run build`;
  - dung lượng tải.

  Đề xuất chỉnh ngân sách design §7.6 nếu cần.
- [ ] **Step 5: Commit** `feat(kira-game): wire the vertical slice end to end`.

## Nghiệm thu Phase 1

1. `npm test` và `npm run typecheck` xanh. `npm run build` không lỗi; JS tải lúc đầu ≤ 400 KB gzip.
2. Chrome PC: Chơi mới, nhập "Hào", chọn Nam → tiệm photo khối hộp, ánh sáng ngày. Đi bằng WASD, xoay camera bằng chuột,
   không xuyên tường, quầy hay máy photo.
3. Thoại: toàn cảnh rồi cận mặt Khánh; biểu cảm ngạc nhiên; nhãn người nói là "Khánh" và "Hào". Lựa chọn
   "Mời Khánh cốc chè · 10 nghìn" hiện mờ, không chọn được bằng chuột hay phím số.
4. Tự do: HUD hiện "Chương 1 · Lớp 10 · Tháng mười" và "Còn 1 buổi rảnh". Ở bậc cửa có dấu, nút tương tác ghi "Đo lại
   vạch nước". Hộp Điện thoại có "Ôn bài với Khánh". Làm một việc thì sang cảnh 2 ở lớp học. Thẻ kết chương hiện "Năm lớp
   10 khép lại."
5. Cảnh cuối: tiệm buổi tối, đồ Tết hiện; Khánh xưng "em" khi người chơi là nam, "anh" khi là nữ. Kết thúc đúng theo
   lựa chọn (`slice_gan` hoặc `slice_xa`) và có trong "Kết thúc đã mở".
6. Tải lại trang lúc đang chọn → Tiếp tục → đúng bối cảnh, thấy lại câu cuối và các lựa chọn. Tải lại lúc đang tự do →
   về tự do, đúng dấu.
7. Cài đặt: đổi Đồ họa Thấp/Cao có hiệu lực ngay; bật Hiện FPS thì thấy số.
8. Bật CPU throttling 6× trong DevTools: trong khoảng 6–8 giây hiện "Đã giảm đồ họa cho mượt hơn"; chơi tiếp không giật
   lên giật xuống.
9. Điện thoại thật (Chrome Android, Safari iPhone): cầm dọc thấy lời nhắc xoay ngang. Cầm ngang chơi được bằng joystick,
   nút tương tác và nút Điện thoại; FPS ≥ 30 ở mức tự chọn.
10. Safari ẩn danh, hoặc đã chặn lưu trữ: game vẫn chơi được và báo không lưu được.
11. Tab Network: không có request nào ra ngoài origin của game.

## Phase 3: các hệ thống còn thiếu (phác thảo)

Viết thành kế hoạch chi tiết, cùng khuôn với file này, khi bắt đầu Phase 3. Mỗi hệ thống có test logic và được xem trên
trình duyệt. Hệ thống nào đổi cổng `WorldPort`/`UiPort` thì sửa luôn `test/fakes.ts` và explorer.

| Hệ thống | Việc chính | Nguồn |
|---|---|---|
| Điện thoại | Bốn mục. Tin nhắn: gom dòng `# tin_nhan` theo người gửi. Ảnh: `# anh` mở ảnh. Lịch: buổi rảnh, hoạt động, truyện mở từ điện thoại (thay hộp chọn của Phase 1). Ví: `tien`, hiện khi `chuong >= 3` | design §5.5 |
| Bản đồ | Bối cảnh của chương có dấu chuyện; đi tới thì giữ kiểu ánh sáng hiện tại, bỏ cách bày. Truyện phụ tự đặt nơi bằng `# den` của nó | design §5.5 |
| Mini-game | Giải đề (`story/giai_de.json`), đá cầu, nấu ăn; lớp phủ DOM, luôn có "Bỏ qua". Thêm `UiPort.mini(game)` trả `'thang' \| 'thua' \| 'bo_qua'`, thay cách Phase 1 tự đặt `bo_qua` | design §5.7 |
| Nhật ký quan hệ | Menu gọi các hàm `nhat_ky_*()` của Ink | `docs/plan-story.md` Task 7 |
| Âm thanh | `# nhac`, `# sfx`, mưa theo `# thoi_tiet`; âm lượng nhạc và hiệu ứng trong Cài đặt; chỉ phát sau lần chạm đầu | design §7.8, §8.8 |
| Trang phục | Gặp `# den` thì Director đọc biến `do_<nv>` và gọi cổng mới `WorldPort.outfits(map)` | design §7.4 |
| Màn Chơi mới | Xem trước nhân vật xoay chậm theo giới tính | design §5.1 |
| Kết thúc, chơi lại | Màn "Kết thúc đã mở" có tóm tắt; chơi lại từ đầu một chương đã xong | design §5.4 |
| Lưu | Xuất/nhập file save | design §7.7 |
| Công cụ dev | Chế độ chụp ảnh chỉ có ở bản dev: ẩn UI, đặt tư thế, chụp canvas | `docs/plan-art.md` Task 5 |
| Lightmap | Bối cảnh có `<mã>-lm-<anh_sang>.ktx2` thì dùng lightmap; preset ánh sáng chỉ còn chiếu nhân vật | design §7.5, `docs/plan-art.md` |
