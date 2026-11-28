# kira-game Phase 4: đồ họa và âm thanh — Kế hoạch

> Phần lớn là việc tay của chủ dự án trong Blender và các công cụ miễn phí. Task 1 là code, làm theo TDD như
> `docs/plan.md`. Các task còn lại là danh sách việc có tiêu chí "Xong khi". Bước dùng checkbox (`- [ ]`).

**Goal:** Thay bối cảnh khối hộp và nhân vật tạm bằng đồ họa bán thực tế cho 8 bối cảnh, 6 mô hình có tên và vài NPC
chung, cộng nhạc và hiệu ứng, trong ngân sách hiệu năng của design §7.6, chỉ bằng công cụ miễn phí và công cụ AI.

**Cách làm:** Làm theo chương: đủ asset cho chương 1 trước, chơi được chương 1 bằng đồ họa thật, rồi mới sang chương
2. Mỗi asset đi cùng một đường ống: dựng trong Blender → xuất `.glb` vào `art/export/` → `npm run assets` (nén, bộ
1K/2K, lightmap KTX2) → kiểm ngân sách → ghi `assets/LICENSES.md` → thay vào game. Một bản thử phong cách đi trước để
chọn cách rig và đo thời gian thật của một asset.

**Spec:** `docs/design.md` mục 6.5, 7.4–7.6, 8 · Danh sách asset đã chốt: `docs/assets.md` (cuối Phase 2) · Bối cảnh,
ánh sáng, cách bày đề xuất: `docs/story/review.md` mục 6.

**Cần có trước:** Phase 2 xong (`docs/assets.md` đã duyệt). Task 1 làm được sớm hơn, song song Phase 3.

## Ràng buộc chung

- Chỉ asset CC0, CC-BY (ghi công) hoặc có giấy phép dùng trong game; đầu ra AI theo design §8.5. Mỗi asset bên ngoài
  một dòng trong `assets/LICENSES.md`: Asset | Nguồn (link) | Giấy phép | Ghi công | Ngày lấy.
- Ngân sách (design §7.6): nhân vật chính 20–30k tam giác, NPC chung ≤ 8k; một bối cảnh ≤ 8 MB ở bộ 1K, ≤ 20 MB ở bộ
  2K; cả khung hình 150k / 300k / 600k tam giác và 100 / 150 / 250 draw call ở Thấp / Vừa / Cao.
- Tên trong `.glb`: điểm neo `spawn_*`, `npc_*`, `diem_*`, `cam_*`; va chạm `collider_*`; cách bày `bt_<cach_bay>`;
  trang phục `do_<bo>` (design §7.4). Bối cảnh thật dùng đúng tên điểm neo của bản khối hộp cùng mã.
- File nguồn (`.blend`, ảnh gốc, file xuất thô) nằm trong `art/`, thư mục này không vào git. Chỉ `assets/` (đã nén)
  vào git.
- File đầu ra: `assets/locations/<mã>/<mã>-{1k,2k}.glb`, lightmap `assets/locations/<mã>/<mã>-lm-<anh_sang>.ktx2`;
  nhân vật `assets/characters/<mã>/<mã>-{1k,2k}.glb`; animation dùng chung `assets/characters/clips.glb`.

## Công cụ

Điều khoản của công cụ AI đổi thường xuyên: đọc lại điều khoản ngày dùng và ghi vào `LICENSES.md`.

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Dựng, UV, nướng ánh sáng | Blender (bản LTS mới nhất) | Cycles để nướng lightmap |
| Thân người, quần áo, tóc | MPFB2 (MakeHuman cho Blender) | Asset hệ thống CC0; asset cộng đồng kiểm từng cái |
| Rig và animation | Mixamo | Miễn phí, dùng trong game được, không phân phối file gốc riêng lẻ |
| Texture, HDRI | Poly Haven, ambientCG | CC0 |
| Mô hình có sẵn | Poly Haven, Sketchfab (lọc CC0 hoặc CC-BY), Kenney, Quaternius | Kenney, Quaternius là low-poly: chỉ dùng cho đồ nhỏ nếu hợp phong cách |
| Tạo 3D bằng AI | Mô hình mở trên Hugging Face Spaces (ví dụ TRELLIS, giấy phép MIT); bản miễn phí của dịch vụ thương mại thường yêu cầu ghi công | Chỉ cho đồ có hình dạng phức tạp; thường phải giảm lưới và sửa UV |
| Tạo ảnh bằng AI | Mô hình mở giấy phép thoáng (ví dụ FLUX.1 [schnell], Apache-2.0) | Tham khảo phong cách, texture không có người, tranh, bao bì |
| Ảnh 2D, chữ | Krita, Inkscape, font Be Vietnam Pro (OFL) | Chữ trên biển và giấy tờ làm tay, không để AI vẽ chữ |
| Nén | `@gltf-transform` (đã có trong module), KTX-Software (`toktx`) | KTX2 cần `toktx` trong PATH |
| Kiểm `.glb` | glTF Validator, `gltf-transform inspect` | |
| Âm thanh | Audacity; Freesound (lọc CC0), Kenney (CC0); tự thu bằng điện thoại | |

---

### Task 1 (code): đường ống nén asset

**Files:**
- Create: `kira-game/tools/assets.ts`, `kira-game/test/assets-tool.test.ts`
- Modify: `kira-game/package.json` (script `assets: node tools/assets.ts`, devDependencies `@gltf-transform/functions`,
  `@gltf-transform/cli`), `kira-game/.gitignore` (thêm `art/`)

**Interfaces:**
- Produces: `optimizeGlb(input: string, outDir: string, id: string): Promise<{ files: string[]; stats: GlbStats }>`;
  `interface GlbStats { triangles: number; primitives: number; textureBytes: number; nodes: string[] }`;
  `checkBudget(kind: 'location' | 'character', set: '1k' | '2k', s: GlbStats & { fileBytes: number }): string[]` (lỗi
  ngân sách, rỗng nếu đạt). CLI: `npm run assets` xử lý mọi file trong `art/export/locations/*.glb`,
  `art/export/characters/*.glb`, `art/export/lightmaps/<mã>-<anh_sang>.png`, rồi in bảng thống kê và lỗi ngân sách.

Đường ống mỗi `.glb`: `dedup` → `prune` giữ node lá (`keepLeaves: true`, vì điểm neo là node rỗng) → `weld` → đổi cỡ
texture về 1024 (bộ 1k) hoặc 2048 (bộ 2k) → KTX2: ETC1S cho texture màu, UASTC cho normal map và texture mặt nhân vật
(tên texture có `normal` hoặc `face`) → `meshopt`. Lightmap PNG → KTX2 UASTC.

- [ ] **Step 1: Viết test fail.** Dựng `.glb` mẫu bằng Document API: một mesh, một texture PNG 4096×4096, node rỗng
  `spawn_mac_dinh`, `npc_tu`, `bt_tet`.

```ts
it('keeps empty anchor nodes and variant groups', async () => {
  const { stats } = await optimizeGlb(sample, out, 'mau');
  for (const n of ['spawn_mac_dinh', 'npc_tu', 'bt_tet']) expect(stats.nodes).toContain(n);
});
it('writes 1k and 2k sets with capped texture size', /* đọc lại hai file: cạnh texture lớn nhất 1024 và 2048 */);
it.runIf(hasToktx())('encodes textures as KTX2', /* mimeType image/ktx2 */);
it('flags a location over budget', () => {
  expect(checkBudget('location', '1k', { triangles: 1, primitives: 1, textureBytes: 1, nodes: [], fileBytes: 9 * 2 ** 20 })).toHaveLength(1);
});
```

- [ ] **Step 2: Chạy `npx vitest run test/assets-tool.test.ts`.** Expected: FAIL, thiếu module.
- [ ] **Step 3: Implement `tools/assets.ts`.** `hasToktx()` dò `toktx --version`; không có thì bỏ bước KTX2, in cảnh
  báo, và test KTX2 tự bỏ qua.
- [ ] **Step 4: Chạy lại.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(kira-game): asset optimization pipeline`.

### Task 2: Thử phong cách (mốc quyết định)

Một nhân vật (`toi_nu`, đồng phục) và một bối cảnh (`tiem_photo`, ánh sáng ngày) tới chất lượng thật.

- [ ] Dựng `toi_nu` bằng MPFB2: tỉ lệ và nét mặt người Việt, tóc đen, da theo ảnh tham khảo; áo sơ mi trắng, quần xanh
  từ quần áo có sẵn.
- [ ] Thử hai cách rig, ghi lại thời gian và lỗi của mỗi cách:
  - A: xuất FBX → Mixamo tự rig → tải lại có skin → tạo shape key biểu cảm trong Blender trên lưới đã rig.
  - B: rig "game engine" của MPFB2, đổi biểu cảm có sẵn của MPFB2 thành shape key, retarget animation Mixamo sang rig
    đó bằng add-on retarget miễn phí.
- [ ] Bốn biểu cảm (bình thường, cười, buồn, ngạc nhiên) và chớp mắt.
- [ ] Dựng `tiem_photo` bản ngày: tường, cửa kéo sắt, quầy, máy photocopy, kệ giấy, ghế thấp sau quầy, bậc cửa có vạch
  bút chì; cùng tên điểm neo với bản khối hộp; nướng lightmap.
- [ ] Chạy trong game: đi lại, cận mặt khi thoại, đo FPS trên ba máy chuẩn (design §7.6), chụp ảnh cận mặt.
- [ ] **Chủ dự án quyết:** nhân vật đủ "thật" chưa, chọn cách rig A hay B. Chưa đủ thật thì chỉnh ánh sáng, khoảng
  cách camera, bớt cận mặt; không mua công cụ (design §12 quyết định 10).
- [ ] Ghi vào cuối file này: cách rig đã chọn, thời gian làm một nhân vật và một bối cảnh, ước lượng thời gian cho phần
  còn lại.

**Xong khi:** hai asset chạy trong game trong ngân sách ở cả ba máy, chủ dự án đã quyết hai câu trên.

### Task 3: Nhân vật

Thứ tự: `toi_nu`, `toi_nam`, `ny_nam`, `ny_nu`, `me`, `tu`, rồi NPC chung.

| Mã | Trang phục (`do_<bo>`) | Ghi chú |
|---|---|---|
| `toi_nu`, `toi_nam` | `dong_phuc`, `thuong_ngay`, `di_lam` | `di_lam` là `thuong_ngay` đổi texture áo |
| `ny_nam`, `ny_nu` | `dong_phuc`, `thuong_ngay`, `di_lam` | như trên |
| `me` | `thuong_ngay` | thêm `tet` nếu còn sức |
| `tu` | `dong_phuc`, `thuong_ngay` | nam (review mục 2.5) |
| NPC chung (3–4 người: học sinh, người lớn tuổi, người đi làm) | một bộ, đổi màu | ≤ 8k tam giác, dùng lưới proxy thấp của MPFB2; đóng vai bác bán chè, cô chủ quán, đồng nghiệp, Linh |

- [ ] Mỗi nhân vật: dựng, trang phục thành các nhóm `do_<bo>`, rig theo cách đã chọn, biểu cảm, xuất, `npm run assets`,
  kiểm ngân sách.
- [ ] `clips.glb`: các động tác có trong `docs/assets.md` (mục `# anim`), tối thiểu: đứng, đi, ngồi, nói, vẫy tay, khóc,
  gật đầu, lắc đầu, cúi xuống, cầm điện thoại. Một file dùng chung cho mọi nhân vật cùng rig.
- [ ] Cử chỉ hai người duy nhất: nắm tay (`c2_chinh_1`). Làm dạng đứng nắm tay (hai clip `nam_tay_a`, `nam_tay_b` khớp
  chung một gốc) và quay cận tay; không làm đi bộ nắm tay.

**Xong khi:** mọi nhân vật trong ngân sách; mọi clip và biểu cảm trong `docs/assets.md` chạy được trong game; có dòng
`LICENSES.md`.

### Task 4: Bối cảnh

Thứ tự theo số cảnh dùng: `tiem_photo` → `ben_xe` → `san_truong` → `quan_ghe_nhua` → `phong_tro` → `lop_hoc` →
`ga_hue` → `van_phong`.

- [ ] Làm một bộ mảnh ghép dùng chung trước: tường gạch men, cửa kéo sắt, cửa sổ song sắt, biển hiệu, nền gạch bông,
  quạt trần, ghế nhựa đỏ. Ba bối cảnh phố (`tiem_photo`, `quan_ghe_nhua`, `van_phong`) dựng chủ yếu từ bộ này.
- [ ] Mỗi bối cảnh:
  - dựng thô theo bản khối hộp, giữ nguyên tên điểm neo;
  - vật liệu từ Poly Haven, ambientCG;
  - đồ vật: hình khối dựng tay; đồ phức tạp lấy CC0 hoặc tạo bằng AI rồi giảm lưới;
  - các nhóm `bt_<cach_bay>` theo `docs/assets.md`;
  - mesh va chạm `collider_*` đơn giản;
  - UV thứ hai, nướng lightmap cho từng kiểu ánh sáng (tối đa 2), khử nhiễu;
  - xuất, `npm run assets`, kiểm ngân sách;
  - vào game kiểm: đi không xuyên, dấu tương tác đúng chỗ, camera `cam_*` nhìn đẹp.
- [ ] Đồ của các nhóm `bt_` dùng ánh sáng realtime hoặc lightmap riêng, không nướng vào atlas chung (design §8.3).

**Xong khi:** mọi bối cảnh và kiểu ánh sáng trong `docs/assets.md` có trong game, trong ngân sách ở cả hai bộ texture.

### Task 5: Ảnh kỷ niệm, chữ, giao diện

- [ ] Ảnh kỷ niệm (`# anh`): dựng tư thế trong cảnh, đặt camera, chụp từ canvas game, thêm lớp màu phim trong Krita. Cần
  một chế độ chụp ảnh chỉ có ở bản dev (Phase 3 thêm). Không dùng ảnh AI có người.
- [ ] Chữ trên biển (XE ĐI HUẾ là chữ Khánh vẽ: làm kiểu chữ vẽ tay trong Krita), giấy tờ, màn hình điện thoại.
- [ ] Biểu tượng cho điện thoại (Tin nhắn, Ảnh, Lịch, Ví) và ảnh màn hình chính.

**Xong khi:** mọi mã `# anh` trong `docs/assets.md` có ảnh; không còn chữ giữ chỗ trong cảnh.

### Task 6: Âm thanh

- [ ] Lấy danh sách `# nhac` và `# sfx` từ `docs/assets.md`.
- [ ] Hiệu ứng đặc trưng tự thu bằng điện thoại: máy photocopy, mưa trên mái tôn, xe máy chạy qua, trống trường, loa
  ga, tiếng quạt. Còn lại lấy CC0.
- [ ] Nhạc: 5–7 bài cho các tâm trạng (đi học, mưa, hẹn hò, xa nhau, Tết, kết thúc).
- [ ] Cắt, chuẩn hóa về khoảng −16 LUFS, xuất MP3 (nhạc 128 kbps, hiệu ứng mono 96 kbps) vào `assets/audio/`.

**Xong khi:** mọi mã âm thanh trong `docs/assets.md` có file; có dòng `LICENSES.md` cho mọi file không tự thu.

### Task 7: Ghép và đo

- [ ] Thay khối hộp bằng bối cảnh thật theo từng chương; chơi lại chương đó.
- [ ] Đo trên ba máy chuẩn, cập nhật `docs/perf.md`; asset nào vượt ngân sách thì giảm rồi đo lại.

**Xong khi:** cả game chạy bằng đồ họa thật, đạt ngân sách design §7.6 trên ba máy chuẩn.

## Kết quả thử phong cách

(Điền sau Task 2: cách rig đã chọn, thời gian thực tế, ước lượng.)
