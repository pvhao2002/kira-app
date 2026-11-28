# kira-game — Thiết kế

> Trạng thái: thiết kế, chưa có code. Cập nhật 2026-11-27.
> Kịch bản do Codex viết riêng trong `docs/story/`: bản đầu là "Chừa một dòng" (`chua-mot-dong.md`), đã review ở
> `docs/story/review.md`. Tài liệu này không chứa nội dung truyện, chỉ đặt khung mà kịch bản phải khớp (mục 6).
> Kế hoạch build: `docs/plan.md` (lộ trình và Phase 1), `docs/plan-story.md` (Phase 2, chuyển kịch bản sang Ink),
> `docs/plan-art.md` (Phase 4, đồ họa và âm thanh).

## 1. Game này là gì

Một game nhập vai 3D chạy trên trình duyệt. Người chơi sống lại tuổi trẻ của một nhân vật qua bốn chặng: cấp 3 →
mối tình đầu → yêu nhau suốt đại học → sau đại học. Nhân vật đi lại tự do trong từng bối cảnh (lớp học, sân trường,
phòng trọ, văn phòng…), gặp người, nói chuyện và lựa chọn. Lựa chọn làm đổi diễn biến, các mối quan hệ và kết thúc.

- Vào là chơi: không tài khoản, chỉ nhập tên và chọn giới tính nhân vật chính.
- Nhân vật trông giống người thật ở mức "The Sims": tỉ lệ người thật, da, vải, tóc kiểu thật; không phải hoạt hình
  hay anime.
- Mỗi chương có truyện chính (bắt buộc) và nhiều truyện phụ đủ kiểu: bạn bè, gia đình, trường lớp, đời sống,
  mini-game. Thời gian mỗi chương có hạn nên một lần chơi không làm hết được.
- Truyện hư cấu, bối cảnh Việt Nam thời nay, giọng "thanh xuân": ngọt nhưng thật, có những đoạn buồn.

Mục đích cụ thể chưa được nêu. Tài liệu coi đây là game kể chuyện cho bất kỳ ai chơi trên web.

## 2. Mục tiêu, không làm, thất bại nếu

**Mục tiêu**
- Chơi được bằng trình duyệt trên PC (bàn phím + chuột) và điện thoại (cảm ứng, màn hình ngang), không cài đặt.
- Mượt trên cả máy yếu lẫn máy mạnh: render ở client, tự chọn mức đồ họa theo máy, tự hạ mức khi tụt FPS.
- 4 chương, một lần chơi khoảng 2–3 giờ, 3–4 kết thúc.
- Tự lưu tiến trình trong trình duyệt; đóng tab, mở lại là chơi tiếp.

**Không làm (bản đầu)**
- Không backend, không database, không tài khoản, không lưu đám mây, không chơi nhiều người.
- Không render ở server (pixel streaming).
- Không lồng tiếng: thoại là chữ.
- Không đồ họa mức phim (kiểu MetaHuman).
- Chỉ tiếng Việt.
- Không quảng cáo, không thu thập dữ liệu người chơi.

**Thất bại dù vẫn chạy được, nếu**
- Điện thoại tầm trung phải chờ lâu hoặc giật đến mức người chơi bỏ.
- Lựa chọn không thật sự đổi gì (chọn gì cũng ra cùng một kết).
- Truyện phụ thành danh sách việc vặt phải "cày".
- Nhân vật khi quay cận mặt trông ghê (uncanny) thay vì gần gũi.
- Mất save mà không báo.
- Có nội dung không phù hợp với nhân vật dưới 18 tuổi (mục 6.6).
- Dùng asset không rõ bản quyền.

## 3. Ràng buộc

- Module độc lập trong monorepo, theo khuôn các module khác: `AGENTS.override.md`, `README.md`, `docs/`. Không dùng
  chung code với module khác.
- Chỉ là web tĩnh: build ra HTML/JS/asset, phát qua CDN.
- Yêu cầu WebGL2 (three.js hiện tại đã bỏ WebGL1). Máy không có WebGL2 phải thấy thông báo rõ ràng, không phải màn
  hình đen.
- Trình duyệt: Chrome, Edge, Firefox, Safari bản hiện hành, gồm Safari iOS và Chrome Android.
- Font phải đủ dấu tiếng Việt.
- Tên người chơi nhập vào chỉ được hiển thị bằng `textContent`, không bao giờ qua `innerHTML`.

## 4. Các hướng đã cân nhắc

| Hướng | Đánh đổi | Kết luận |
|---|---|---|
| **A. 3D bằng three.js, render ở client** | Đi lại tự do, nhân vật mức The Sims. Repo đã dùng three.js (`kira-portfolio-3d`). Nặng trên điện thoại yếu nên cần mức đồ họa thích ứng. | **Chọn** |
| B. Godot hoặc Unity xuất ra web | Có editor nên làm 3D nhanh hơn; nhưng bộ công cụ mới, file web nặng hơn, độ "thật" trên web không hơn A. | Loại |
| C. Đi lại 2D nhìn từ trên xuống + cảnh truyện bằng ảnh như thật | Nhẹ, làm nhanh nhất; nhưng lúc đi lại nhân vật không giống người thật. | Loại |
| Render ở server (pixel streaming) | Đồ họa mức game PC; nhưng tốn tiền GPU theo từng giờ chơi, trễ và giật trên 4G. | Loại |
| Video quay người thật (FMV) | Thật nhất; nhưng không đi lại được và phải thuê diễn viên. | Loại |

Chủ dự án chọn A sau khi so các hướng trên.

## 5. Trải nghiệm người chơi

### 5.1 Bắt đầu

Màn hình chính: Tiếp tục · Chơi mới · Kết thúc đã mở · Cài đặt · Giới thiệu & bản quyền.

Chơi mới: nhập tên (1–16 ký tự: chữ có dấu và khoảng trắng), chọn Nam hoặc Nữ (xem trước nhân vật 3D xoay chậm).
Người yêu luôn khác giới với nhân vật chính. Người yêu có hai bản, nam và nữ: cùng tính cách, cùng câu chuyện, khác
tên và ngoại hình.

```
+------------------------------------------------+
|            (nhân vật 3D xoay chậm)             |
|                                                |
|   Tên của bạn: [ Hào_____________ ]            |
|   [ Nam ]  [ Nữ ]                              |
|                              [ Bắt đầu -> ]    |
+------------------------------------------------+
```

### 5.2 Vòng chơi trong một chương

1. Truyện chính chạy một cảnh: cắt cảnh, thoại, lựa chọn.
2. Hết cảnh, người chơi có **buổi rảnh** (Ink đặt số buổi; kịch bản hiện tại cho đúng một buổi sau mỗi cảnh chính
   1–5): đi lại tự do trong bối cảnh hiện tại, hoặc mở bản đồ sang bối cảnh khác.
3. Chỗ nào có chuyện thì hiện dấu trên đầu NPC hoặc ở điểm tương tác. Truyện bắt đầu bằng cuộc gọi hay tin nhắn thì
   hiện trong điện thoại, mở được ở bất kỳ đâu. Mỗi phần truyện phụ hoặc mỗi hoạt động tốn 1 buổi.
4. Hết buổi rảnh, hoặc người chơi chọn "Để thời gian trôi", thì sang cảnh truyện chính tiếp theo.
5. Cảnh chính cuối chương xong thì hiện thẻ kết chương (tóm tắt các mối quan hệ), rồi sang chương sau.

Ngoài truyện phụ có kịch bản còn có **hoạt động thường làm**, mỗi lần chỉ vài dòng: học (+năng lực), gọi về nhà
(+gia đình), ngồi với bạn (+bạn bè), làm thêm (+tiền, từ chương 3). Hoạt động mở từ mục Lịch trong điện thoại và mỗi
hoạt động làm được một lần mỗi chương. Nếu làm lặp được, người chơi sẽ dồn cả chương vào một chỉ số; làm một lần thì
mỗi buổi rảnh vẫn là một lựa chọn thật.

### 5.3 Chỉ số và hậu quả

- 5 chỉ số: tình cảm (với người yêu), năng lực (học lực khi đi học, sự nghiệp khi đi làm), gia đình, bạn bè, tiền
  (từ chương 3).
- Bốn chỉ số quan hệ ẩn. Người chơi chỉ thấy phản hồi bằng lời ("[Người yêu] sẽ nhớ điều này.") và một nhật ký quan
  hệ mô tả bằng chữ ("Hai người đang hơi xa nhau"). Lý do: giữ cảm giác sống thật, tránh người chơi tính điểm.
- Tiền thì hiện, ở mục Ví trong điện thoại từ chương 3, vì nhân vật biết rõ mình còn bao nhiêu. Lựa chọn cần tiền mà
  không đủ vẫn hiện nhưng bị khóa, kèm giá, để người chơi thấy những lần nhận ca hay tiêu tiền trước đó có hậu quả.
  Lựa chọn cần một chỉ số ẩn (ví dụ gia đình đủ cao) thì ẩn hẳn khi chưa đạt.
- Cờ (sự kiện đã xảy ra) mang sang các chương sau. Ví dụ: đã giúp bạn thân ở chương 1 thì chương 4 bạn thân giúp lại.
- Kết quả thi THPT và nguyện vọng ở chương 2 (từ năng lực + lựa chọn) quyết định chương 3 hai người học cùng thành
  phố hay yêu xa.

### 5.4 Kết thúc và chơi lại

- 3–4 kết thúc, tính ở cuối chương 4 từ chỉ số, cờ và lựa chọn cuối.
- "Kết thúc đã mở" lưu riêng và giữ qua các lần chơi.
- Chương nào đã xong thì chơi lại được từ đầu chương đó, với chỉ số lúc ấy (điểm lưu đầu chương).

### 5.5 Điện thoại, bản đồ, menu

- **Điện thoại trong game**: Tin nhắn (người yêu, bạn bè, gia đình nhắn tới; trả lời có lựa chọn; mở các truyện phụ
  bắt đầu bằng cuộc gọi hay tin nhắn), Ảnh (ảnh kỷ niệm mở theo truyện), Lịch (chương, thời điểm, số buổi rảnh còn
  lại, các hoạt động thường làm), Ví (tiền, từ chương 3). Tin nhắn là cách rẻ nhất để thêm chuyện vì không cần đồ họa
  3D; ở chương yêu xa nó là kênh chính.
- **Bản đồ**: danh sách bối cảnh của chương hiện tại, đánh dấu chỗ đang có chuyện. Chọn một nơi thì màn hình mờ đi và
  tải bối cảnh đó.
- **Menu**: Tiếp tục, Nhật ký quan hệ, Cài đặt, Về màn hình chính.

### 5.6 Màn hình khi chơi

Đi lại tự do:

```
+------------------------------------------------------+
| Chương 1 · Lớp 10 · Tháng 11   Còn 1 buổi rảnh   [ĐT] [=] |
|                                                      |
|         (3D: nhân vật đi trong sân trường)           |
|                    (!)  <- NPC có chuyện             |
|                                                      |
|  (joystick)                     [ Nói chuyện ]       |
+------------------------------------------------------+
```

Thoại: camera chuyển cận cảnh, khung thoại ở dưới.

```
+------------------------------------------------------+
|        (camera cận mặt người yêu, đang cười)         |
+------------------------------------------------------+
| [Tên người yêu]                                      |
| Cậu cũng đi xe buýt số 9 à?                          |
|   > "Ừ, ngày nào tớ cũng đi."                        |
|   > "Không, hôm nay xe tớ hỏng."                     |
|                   [Tự động] [Bỏ qua] [Lịch sử]       |
+------------------------------------------------------+
```

(Câu thoại trong khung chỉ minh họa giao diện, không phải kịch bản.)

### 5.7 Mini-game

2–3 mini-game ngắn (1–2 phút): giải đề (trắc nghiệm có giới hạn giờ), đá cầu (bấm đúng nhịp), nấu ăn (làm đúng thứ
tự). Luôn có nút "Bỏ qua" cho kết quả trung bình: mini-game không bao giờ chặn truyện. Mini-game là lớp phủ 2D (DOM)
trên màn hình, không dùng cảnh 3D, nên không cần animation riêng.

### 5.8 Cài đặt

Đồ họa (Tự động/Thấp/Vừa/Cao), hiện FPS, âm lượng nhạc và hiệu ứng, tốc độ chữ, cỡ chữ, giảm chuyển động (tắt rung,
lắc camera). Lưu trong trình duyệt.

## 6. Khung kịch bản (hợp đồng với người viết truyện)

Khi review, kịch bản được đối chiếu với mục này. Chỗ nào lệch thì quyết lúc review: sửa kịch bản hoặc sửa thiết kế.

### 6.1 Bốn chương

| Chương | Giai đoạn | Nút chính |
|---|---|---|
| 1. Cấp 3 | lớp 10–11 | quen nhau, bạn bè, cảm nắng |
| 2. Tình đầu | lớp 12 | tỏ tình, yêu lần đầu, áp lực thi, chọn nguyện vọng → cùng thành phố hay yêu xa |
| 3. Đại học | 4 năm đại học | yêu tiếp (gần hoặc xa), người mới, ghen, làm thêm, tiền |
| 4. Sau đại học | 1–3 năm đầu đi làm | công việc, gia đình giục cưới, chọn ưu tiên → kết thúc |

Mốc cụ thể trong từng chương theo kịch bản.

### 6.2 Mỗi chương

- Truyện chính: 5–6 cảnh, bắt buộc, theo thứ tự.
- Truyện phụ: 5–6 truyện, mỗi truyện 1–3 phần, mỗi phần tốn 1 buổi rảnh. Đủ kiểu: bạn bè, gia đình, trường lớp (công
  việc ở chương 4), đời sống, mini-game.
- Tổng buổi rảnh của chương chỉ bằng khoảng 60–70% tổng số phần truyện phụ cộng hoạt động đáng làm, để một lần chơi
  không làm hết được.
- Mỗi chương có ít nhất một truyện phụ gây hậu quả ở chương sau.
- Mỗi cảnh ghi rõ: bối cảnh, nhân vật có mặt, thời điểm.

### 6.3 Xưng hô theo giới tính

- Câu dùng chung cho cả hai giới không viết cứng từ có giới tính; dùng hàm, ví dụ `{ny_goi_toi()}` cho ra
  "anh"/"em", `{ban_trai_gai()}` cho ra "bạn trai"/"bạn gái".
- Ở cấp 3 dùng "cậu – tớ" (không lộ giới tính) càng nhiều càng tốt. Từ khi yêu nhau: bên nam xưng "anh", bên nữ xưng
  "em". Các hàm xưng hô tự đổi theo cờ `co_yeu_nhau` (bảng ở mục 7.3), nên một câu viết một lần dùng được cả trước và
  sau khi yêu.
- Đầu câu dùng bản viết hoa của hàm, ví dụ `{Ny_xung()} sẽ vui nếu…`.
- Đoạn nào thật sự khác nhau theo giới tính thì tách nhánh, nhưng giữ càng ít càng tốt.
- Người yêu có hai tên (bản nam, bản nữ). Trong kịch bản gọi chung bằng mã `ny`. Kịch bản hiện tại chọn hai tên cùng
  chữ cuối ("Minh Khánh" khi người chơi là nữ, "An Khánh" khi người chơi là nam), nên nhãn người nói và lời dẫn đều
  dùng "Khánh"; tên đầy đủ lấy bằng `{ten_ny()}`.

### 6.4 Chỉ số, cờ, hiệu ứng

- Chỉ số: `tinh_cam`, `nang_luc`, `gia_dinh`, `ban_be` (0–100), `tien` (nghìn đồng, từ chương 3).
- Lựa chọn nào có hiệu ứng thì ghi rõ, ví dụ `[tinh_cam +5]`, `[co: giup_ban_than_c1]`.
- Thay đổi thường từ ±2 tới ±10; mức lớn hơn chỉ dành cho cảnh then chốt.
- Tiền không bao giờ âm: lựa chọn nào trừ tiền thì có điều kiện đủ tiền, và mức điều kiện bằng đúng số tiền trừ (giá
  ghi trên lựa chọn).
- Mỗi kết thúc ghi rõ điều kiện (chỉ số, cờ, lựa chọn).

### 6.5 Giới hạn theo đồ họa

Mỗi nhân vật là một mô hình 3D, mỗi bối cảnh là một cảnh 3D phải làm, nên kịch bản phải nằm trong:
- Tối đa 12 bối cảnh cho cả game, dùng lại qua nhiều chương (nhà, sân trường… đổi đồ trang trí theo thời gian).
- Tối đa 10 mô hình nhân vật có tên. Nhân vật chính và người yêu mỗi người có 2 bản (nam/nữ), tức đã chiếm 4 mô hình.
  Những người khác chỉ xuất hiện qua tin nhắn/điện thoại, hoặc là NPC chung không tên.
- Tối đa 4 bộ trang phục cho mỗi nhân vật chính, 2 bộ cho mỗi nhân vật phụ. Cộng lại có thể tới khoảng 28 bộ, phần
  đồ họa nặng nhất, nên kịch bản nên dùng ít hơn mức tối đa.
- Cảnh đông người (lễ, sân trường) dùng NPC chung.
- Mỗi bối cảnh tối đa 2 kiểu ánh sáng (ví dụ ngày + hoàng hôn, hoặc ngày + đêm), cả game tối đa 16 kiểu. Mưa là hiệu
  ứng chồng lên một kiểu có sẵn, không tính thêm. Thời điểm của mỗi cảnh phải rơi vào một kiểu ánh sáng mà bối cảnh đó
  có.
- Cử chỉ đặc biệt của một người (khóc, ngã…) liệt kê riêng để làm animation. Cử chỉ hai người (ôm, nắm tay…) phải làm
  tay từng cái, nên cả game tối đa 6.

### 6.6 Nội dung phù hợp độ tuổi

- Cả game ở mức 13+.
- Chương 1–2, nhân vật dưới 18 tuổi: tình cảm trong sáng, tối đa là nắm tay, ôm, một nụ hôn nhẹ. Không có nội dung
  tình dục hay gợi dục, không mô tả cơ thể theo hướng gợi cảm.
- Chương 3–4 (người lớn) cũng không có cảnh nóng; chuyện thân mật nếu có thì chỉ ngụ ý và cắt cảnh.
- Chủ đề nặng (bệnh tật, mất người thân, trầm cảm…) nếu có thì viết tôn trọng, và game hiện cảnh báo nội dung ở đầu.

### 6.7 Định dạng bàn giao

- Bản viết: Markdown trong `docs/story/`, dễ đọc và dễ review.
- Bản chạy: Ink (`story/*.ink`), chuyển từ Markdown sau khi kịch bản được duyệt. Từ lúc đó Ink là nguồn chính;
  Markdown chỉ còn để tham khảo.
- Bản viết có thể ở dạng tóm tắt cảnh và lựa chọn (như "Chừa một dòng"). Lúc chuyển Ink, mỗi cảnh nở thành thoại từng
  dòng theo quy tắc ở `docs/plan-story.md`. Chương 1 được chủ dự án duyệt trước để chốt giọng, rồi mới làm các chương
  sau.
- Mỗi cảnh, mỗi truyện có mã ổn định bằng chữ không dấu (ví dụ `c1_chinh_3`, `c2_phu_ban_than`) để code, save và test
  tham chiếu.
- Ngoài các cảnh, kịch bản cần có thêm phần chữ sau:
  - mô tả nhật ký quan hệ theo từng mức chỉ số;
  - thẻ tóm tắt cuối mỗi chương;
  - lời cho các hoạt động lặp lại (vài biến thể cho mỗi hoạt động);
  - tin nhắn điện thoại;
  - câu hỏi cho mini-game giải đề;
  - tên và một dòng tóm tắt cho mỗi kết thúc;
  - cảnh báo nội dung, nếu có.

  Phần nào người viết chưa giao thì Claude viết theo giọng của kịch bản lúc chuyển sang Ink, rồi chủ dự án duyệt.
- Danh sách asset (bối cảnh, kiểu ánh sáng, nhân vật, trang phục, cử chỉ, biểu cảm) được rút từ kịch bản đã duyệt và
  chốt ở cuối Phase 2. Đồ họa thật chỉ bắt đầu sau mốc này.

## 7. Kỹ thuật

### 7.1 Stack

| Phần | Chọn | Lý do |
|---|---|---|
| Build | Vite + TypeScript strict | Web tĩnh, không cần SSR. |
| 3D | three.js (`WebGLRenderer`, WebGL2) | Hướng A; repo đã dùng three.js. `WebGPURenderer` để sau, khi cần. |
| Giao diện | DOM + CSS thường, `<dialog>` cho menu | UI mỏng (thoại, menu, điện thoại); thêm framework chỉ làm nặng và giành vòng render. |
| Kịch bản | Ink + inkjs | Ngôn ngữ chuyên cho truyện rẽ nhánh: biến, điều kiện, lưu trạng thái ra JSON, chạy headless để test. Không tự chế định dạng. |
| Va chạm khi đi | three-mesh-bvh (capsule va vào mesh tĩnh) | Bối cảnh tĩnh, không cần engine vật lý. |
| Đoán cấu hình | detect-gpu, dữ liệu benchmark tự host | Có sẵn bảng điểm GPU. |
| Hậu kỳ | addons có sẵn của three.js (EffectComposer, FXAA, SMAA, bloom, AO) | Không thêm thư viện. Đo thấy chậm thì đổi sang `postprocessing` của pmndrs. |
| Âm thanh | Web Audio qua `THREE.AudioListener` / `THREE.Audio` | Có sẵn trong three.js. |
| Test | Vitest | Test logic và chạy kịch bản headless trong Node. |
| Asset | Blender → glTF, gltf-transform (Meshopt + KTX2) | Chuẩn glTF, nén tốt cho web. |

### 7.2 Các phần của game

```
main -> Boot (kiểm WebGL2, đoán cấu hình, tải UI)
          |
          v
      Title / NewGame ------------------> SaveStore (localStorage)
          |
          v
      StoryRunner (inkjs) <------------ tag ---------------+
          | dòng thoại, lựa chọn, tag                       |
          v                                                 |
      Director --- # den ---> World (three.js)              |
          |                    |- LocationLoader (glb theo mức đồ họa)
          |                    |- Player (đi, va chạm BVH)
          |                    |- Characters (animation, biểu cảm)
          |                    |- CameraRig (theo sau / cận cảnh)
          |                    '- Interactables (NPC có dấu, điểm tương tác)
          |--> UI (thoại, lựa chọn, HUD, điện thoại, bản đồ, menu)
          '--> QualityManager (mức đồ họa, đo FPS)
```

- **StoryRunner**: bọc inkjs. Trả từng dòng (người nói, chữ, tag) và các lựa chọn; đọc/ghi biến; lưu và khôi phục
  trạng thái.
- **Director**: điều phối. Đọc tag để gọi World và UI. Ở chế độ tự do, hỏi Ink truyện nào đang mở (hàm `mo_<mã>()`),
  đặt dấu lên NPC hoặc điểm tương ứng; người chơi chạm vào thì chạy truyện đó.
- **World**: mỗi lúc chỉ có một bối cảnh; tải trước bối cảnh kế tiếp lúc rảnh.
- **QualityManager**: mục 7.5.

### 7.3 Ink: quy ước

- Biến code đọc hoặc ghi, khai báo trong `story/lib/core.ink`: `ten`, `gioi_tinh` (`"nam"`/`"nu"`), `chuong`,
  `buoc_chinh` (cảnh chính thứ mấy trong chương), `buoi_ranh`, `thoi_diem` (chữ cho HUD, ví dụ "Lớp 10 · Tháng 11"),
  `tinh_cam`, `nang_luc`, `gia_dinh`, `ban_be`, `tien`, `ket_thuc`, `ket_qua_mini`, `co_yeu_nhau`.
- Biến riêng của kịch bản (các cờ dạng `co_<tên_cờ>`, và với "Chừa một dòng" là `diem_thi`, `xep_truoc`, `noi_hoc`)
  khai báo trong file của kịch bản. Code không đọc chúng.
- Tăng/giảm bốn chỉ số quan hệ qua một hàm có kẹp 0–100, dùng tham số `ref`: `~ doi(tinh_cam, 5)`. Tiền đổi bằng
  phép gán (`~ tien = tien - 50`), theo luật ở mục 6.4.
- Hàm xưng hô:

| Hàm | Trước khi yêu | Đã yêu, người chơi nam | Đã yêu, người chơi nữ |
|---|---|---|---|
| `ny_goi_toi()` (người yêu gọi người chơi) | cậu | anh | em |
| `ny_xung()` (người yêu tự xưng) | tớ | em | anh |
| `toi_goi_ny()` (người chơi gọi người yêu) | cậu | em | anh |
| `toi_xung()` (người chơi tự xưng) | tớ | anh | em |

  Bốn hàm trên có bản viết hoa cho đầu câu: `Ny_goi_toi()`, `Ny_xung()`, `Toi_goi_ny()`, `Toi_xung()`. Ba hàm sau chỉ
  theo giới tính người chơi (nam / nữ): `ban_trai_gai()` cho "bạn gái" / "bạn trai", `con_trai_gai()` cho "con trai" /
  "con gái", `ten_ny()` cho "An Khánh" / "Minh Khánh".
- Người nói: dòng mở đầu bằng mã nhân vật và dấu hai chấm (`ny: …`, `me: …`, `toi: …`). Chỉ coi là người nói khi mã
  có trong danh sách nhân vật; còn lại là lời dẫn. `toi` hiển thị tên người chơi; `ny` hiển thị tên người yêu theo
  giới tính.
- Tag có cú pháp `# khóa: giá trị`. Theo luật của Ink, tag ở cuối dòng thuộc về dòng đó; tag đứng riêng một dòng thuộc
  về dòng nội dung kế tiếp.

| Tag | Ý nghĩa |
|---|---|
| `# den: <dia_diem> [anh_sang] [cach_bay]` | Chuyển bối cảnh; kiểu ánh sáng mặc định là `ngay`; cách bày (mục 7.4) mặc định là bày thường |
| `# cam: <preset>` | Góc camera: `toan_canh`, `qua_vai`, `can_mat <nv>` |
| `# bieu_cam: <nv> <bc>` | Biểu cảm: `binh_thuong`, `cuoi`, `buon`, `ngac_nhien`, `gian`, `ngai`, `khoc` |
| `# anim: <nv> <clip>` | Động tác: `ngoi`, `vay_tay`, `om`, `nam_tay`… |
| `# nhac: <bai>` / `# sfx: <am>` | Âm thanh |
| `# tin_nhan` | Dòng này là tin nhắn điện thoại; người gửi là người nói của dòng |
| `# anh: <ma_anh>` | Mở một ảnh kỷ niệm |
| `# mini: <game>` | Chạy mini-game; kết quả ghi vào `ket_qua_mini` (`thang`/`thua`/`bo_qua`) |
| `# ket_chuong` | Hết chương: chữ của dòng hiện trên thẻ kết chương; game lưu điểm đầu chương sau |
| `#khoa` (trong ngoặc vuông của lựa chọn) | Lựa chọn hiện mờ, không bấm được (dùng cho phương án thiếu tiền) |

- Truyện phụ và hoạt động có hai tag ở đầu knot: `# o: <dia_diem> <diem_neo>` (đặt dấu ở điểm neo đó) hoặc
  `# o: dien_thoai` (mở từ điện thoại ở bất kỳ đâu), và `# ten: <nhãn>` (chữ hiện trên nút tương tác hoặc trong điện
  thoại, ví dụ "Đo lại vạch nước"). Hai tag này phải là hai dòng đầu tiên của knot, trước mọi dòng `~`: inkjs chỉ đọc
  tag đầu knot cho tới lệnh đầu tiên. Lúc chạy, Ink gắn chúng vào dòng thoại đầu của knot; Director bỏ qua chúng. Điều
  kiện mở là hàm `mo_<tên knot>()` viết trong Ink.
- Lựa chọn cần chỉ số ẩn: một lựa chọn có điều kiện, ví dụ `* {gia_dinh >= 60} [Nhờ mẹ đổi giờ]`, ẩn khi chưa đạt.
  Lựa chọn cần tiền: viết hai bản cùng chữ, `* {tien >= 50} [Đi xe buýt · 50 nghìn]` và
  `* {tien < 50} [Đi xe buýt · 50 nghìn #khoa]`.
- Chữ trên nút lựa chọn tối đa khoảng 60 ký tự. Phần diễn giải dài thành các dòng thoại ngay sau lựa chọn.
- Tên knot: truyện chính `c<n>_chinh_<k>`, truyện phụ `c<n>_phu_<tên>`, hoạt động `c<n>_hd_<tên>`, mở đầu chương
  `chuong_<n>`.
- Luồng chương:
  - `chuong_<n>` đặt `chuong`, `buoc_chinh = 0`, `buoi_ranh = 0`, `thoi_diem`, rồi `-> hub`.
  - `hub`: còn buổi rảnh thì dừng (`-> DONE`), tức là vào chế độ tự do. Hết buổi rảnh thì tăng `buoc_chinh` và sang
    `chinh_tiep`.
  - `chinh_tiep` đưa tới `c<chuong>_chinh_<buoc_chinh>`.
  - Cảnh chính đặt `buoi_ranh` cho khoảng rảnh tiếp theo rồi `-> hub`. Cảnh chính cuối chương có dòng mang
    `# ket_chuong` rồi `-> chuong_<n+1>`. Cảnh cuối game đặt `ket_thuc` rồi `-> END`.
  - Truyện phụ và hoạt động trừ 1 buổi ở đầu knot và kết thúc bằng `-> hub`.
- Kịch bản dừng mà không có lựa chọn: `ket_thuc` rỗng là chế độ tự do; `ket_thuc` khác rỗng là kết thúc game.
- Toàn bộ nội dung và logic truyện nằm trong Ink. Code TypeScript không biết gì về một truyện cụ thể.

### 7.4 Thế giới 3D

- Mỗi bối cảnh là một file `.glb` nhỏ (một phòng hoặc một khoảng sân), không phải thế giới mở. Đi giữa các bối cảnh
  bằng bản đồ.
- Điểm neo đặt trong Blender bằng empty đặt tên theo quy ước (`spawn_*`, `npc_*`, `diem_*`, `cam_*`), nên code không
  chứa tọa độ.
- Mesh va chạm riêng, đơn giản (`collider_*`), ẩn khi render.
- Cách bày: các nhóm đồ tên `bt_<cach_bay>` (ví dụ `bt_tet`, `bt_tiem_in`, `bt_nha_di`). Khi vào bối cảnh, chỉ nhóm
  trùng tham số thứ ba của `# den` được hiện; không có tham số thì ẩn mọi nhóm `bt_`. Nhờ vậy một bối cảnh dùng được
  cho tiệm nhà và tiệm in gần trường, ngày thường và ngày Tết, phòng trọ và góc phòng nhà dì.
- Điều khiển trên PC: WASD hoặc mũi tên, kéo chuột để xoay camera, E hoặc Space để tương tác, Esc mở menu.
- Điều khiển trên điện thoại: joystick ảo bên trái (tự viết, vài chục dòng), kéo nửa phải màn hình để xoay camera, nút
  tương tác.
- Camera đi theo sau, có tránh xuyên tường (raycast vào BVH). Khi vào thoại, camera chuyển tới preset theo tag.
- Mọi nhân vật dùng chung một bộ xương nên dùng chung animation. Biểu cảm bằng morph target. Không nhép môi (không lồng
  tiếng): lúc nói chỉ có animation nói và biểu cảm.
- Trang phục: mỗi bộ là một nhóm `do_<bo>` trong `.glb` của nhân vật. Ink giữ bộ đang mặc trong biến `do_<mã nhân
  vật>` (ví dụ `~ do_toi = "thuong_ngay"`), nên trang phục được lưu cùng trạng thái Ink; World áp biến này mỗi khi vào
  bối cảnh.
- Cầm điện thoại dọc thì hiện lời nhắc xoay ngang.

### 7.5 Đồ họa thích ứng

**Lúc mở game.** Người chơi đã chọn mức thì dùng mức đó. Nếu là "Tự động": detect-gpu cho hạng 0–1 → Thấp, 2 → Vừa,
3 → Cao. Điện thoại mặc định tối đa Vừa (đỡ nóng máy, tốn pin); người chơi vẫn tự chọn Cao được.

**Lúc chơi.** Đo FPS theo từng cửa sổ 2 giây, chỉ khi đang hiện cảnh 3D (bỏ qua lúc tải, lúc tab bị ẩn, và khung hình
dài hơn 500 ms). Ba cửa sổ liền nhau dưới ngưỡng (PC 50 FPS, điện thoại 27 FPS) thì hạ một mức, báo nhỏ "Đã giảm đồ
họa cho mượt hơn", chờ 10 giây rồi mới xét tiếp. Đang ở Thấp mà vẫn chậm thì giảm độ phân giải vẽ, thấp nhất 0,6.

**Chỉ tự hạ, không tự nâng.** Trình duyệt khóa FPS theo tần số màn hình và hầu như không cho đo thời gian GPU, nên
không biết chắc máy còn dư sức; tự nâng dễ gây giật lên giật xuống. Mỗi lần mở game, mức tự động được tính lại từ
đầu; muốn cao hơn thì chọn trong Cài đặt.

| | Thấp | Vừa | Cao |
|---|---|---|---|
| Độ phân giải vẽ (tối đa, nhân với devicePixelRatio) | 1,0 | 1,5 | 2,0 |
| Texture | bộ 1K | bộ 1K, nhân vật chính 2K | bộ 2K |
| Bóng đổ | bóng mờ giả dưới chân | shadow map 1024, chỉ cho nhân vật | shadow map 2048, bóng mềm |
| Khử răng cưa | không | FXAA | SMAA |
| Hậu kỳ | không | không | bloom nhẹ + AO |
| NPC chung tối đa | 3 | 6 | 10 |

Ánh sáng môi trường được nướng sẵn thành lightmap ở mọi mức (mục 8.3–8.4); chỉ nhân vật được chiếu sáng realtime.

### 7.6 Tải asset và ngân sách hiệu năng

- Mỗi bối cảnh và nhân vật có hai bộ texture (1K, 2K); chỉ tải bộ của mức hiện tại.
- Tải trước bối cảnh kế tiếp (đoán từ truyện) trong lúc đang thoại hoặc đi lại.
- Tên file có hash nên cache được 1 năm; `index.html` không cache.

Ngân sách khởi đầu, sẽ chỉnh lại sau khi đo bản thử:

| | Ngân sách |
|---|---|
| JS tải lúc đầu (gzip) | ≤ 400 KB |
| Màn hình chính sẵn sàng trên 4G | ≤ 3 giây |
| Một bối cảnh, mức Thấp / Cao | ≤ 8 MB / ≤ 20 MB |
| Tam giác mỗi khung hình (Thấp / Vừa / Cao) | 150k / 300k / 600k |
| Draw call (Thấp / Vừa / Cao) | 100 / 150 / 250 |
| Nhân vật chính / NPC chung | 20–30k / ≤ 8k tam giác |
| FPS mục tiêu | PC 60, điện thoại 30 |

Máy chuẩn để đặt ngân sách, đo ở nghiệm thu Phase 1 và Phase 5:
- Điện thoại Android tầm trung phổ biến ở Việt Nam (chip cỡ Helio G99 hoặc Snapdragon dòng 6, RAM 4–6 GB): mức Thấp,
  30 FPS.
- iPhone 11 trở lên: mức Vừa, 30 FPS.
- PC hoặc laptop dùng GPU tích hợp (Intel Iris Xe hoặc tương đương): mức Vừa, 60 FPS.

Chủ dự án đo trên máy mình có. Thiếu loại máy nào thì mượn, hoặc dùng dịch vụ cho thuê máy thật từ xa.

### 7.7 Lưu game

- `localStorage`, ba khóa:
  - `kira-game:save`: bản đang chơi. Gồm phiên bản định dạng save, mã phiên bản kịch bản, tên, giới tính, chương,
    trạng thái Ink (JSON), bối cảnh hiện tại, câu thoại cuối cùng, thời điểm lưu.
  - `kira-game:checkpoints`: trạng thái ở đầu mỗi chương, kèm bản sao các biến Ink.
  - `kira-game:profile`: kết thúc đã mở, chương đã xong, cài đặt.
- Tự lưu mỗi khi game chờ người chơi chọn, mỗi khi vào chế độ tự do, và ở đầu mỗi chương. Khi chơi tiếp, game hiện lại
  câu thoại cuối cùng để người chơi nhớ đang ở đâu.
- inkjs chỉ ghi vào trạng thái các biến khác giá trị mặc định. Bản sao biến ở điểm lưu đầu chương cũng vậy; khi khôi
  phục, game đặt các biến đó lên một câu chuyện vừa nạp (biến nào bản mới không còn thì bỏ qua).
- Khi kịch bản đổi phiên bản và trạng thái Ink cũ không nạp được: khôi phục từ điểm lưu đầu chương (đặt lại biến, nhảy
  tới đầu chương) và báo cho người chơi.
- Mọi lần đọc/ghi đều bọc try/catch (Safari ẩn danh, bộ nhớ đầy). Không lưu được thì báo, game vẫn chạy tiếp.
- Sau này: xuất/nhập file save để chuyển máy.

### 7.8 Âm thanh

Nhạc nền theo bối cảnh và tâm trạng; hiệu ứng (trống trường, ve, mưa, xe máy…). Chỉ phát sau lần chạm hoặc bấm phím
đầu tiên (luật autoplay của trình duyệt).

### 7.9 Bảo mật, riêng tư

- Không gửi dữ liệu đi đâu; không cookie, không analytics.
- Chữ trong kịch bản và tên người chơi chỉ hiển thị bằng `textContent`. Cần chữ nghiêng/đậm thì dùng một bộ phân tích
  nhỏ, không dùng HTML.
- Khi deploy: CSP chặt, `script-src 'self' 'wasm-unsafe-eval'` (bộ giải mã KTX2 và Meshopt dùng WebAssembly), không
  tải script từ CDN ngoài.

## 8. Sản xuất đồ họa

Đây là phần tốn công và rủi ro nhất của dự án. Chủ dự án tự làm đồ họa và âm thanh, dùng asset miễn phí và công cụ
AI, không mua asset hay công cụ. Vì một người làm, toàn bộ game được dựng chơi được bằng bối cảnh khối hộp trước
(Phase 3), rồi mới thay dần bằng đồ họa thật (Phase 4), theo thứ tự cảnh nào xuất hiện nhiều nhất làm trước. Kế hoạch
chi tiết: `docs/plan-art.md`.

### 8.1 Phong cách

Bán thực tế kiểu The Sims: tỉ lệ người thật, vật liệu PBR (da, vải, tóc), ánh sáng ấm, màu phim nhẹ (tone mapping
AgX). Dấu hiệu Việt Nam rõ ràng: áo trắng quần xanh, áo dài trắng, cây phượng, ghế nhựa đỏ, xe máy, quán trà đá. Cảnh
kỷ niệm dùng ánh sáng giờ vàng; mùa mưa, Tết, mùa thi có tông màu riêng.

### 8.2 Nhân vật

- Thân người: MPFB2 (MakeHuman trong Blender, đầu ra CC0), chỉnh khuôn mặt người Việt.
- Xương: một rig dùng cho game, dùng chung cho mọi nhân vật.
- Animation: Mixamo (miễn phí, được dùng trong game), retarget sang rig chung.
- Cử chỉ hai người (ôm, nắm tay…) Mixamo không có: làm keyframe trong Blender cho từng cặp nhân vật, tối đa 6 cái
  (mục 6.5).
- Biểu cảm: shape key xuất thành morph target. Bắt đầu với bình thường, cười, buồn, ngạc nhiên và chớp mắt; giận,
  ngại, khóc thêm sau nếu cảnh cần. Cảnh khóc có thể quay từ phía sau hoặc cận tay thay vì cận mặt.
- Lớn lên qua các chương bằng đổi tóc, quần áo, dáng; không làm mô hình mới cho mỗi độ tuổi.
- Trang phục: đồng phục (áo sơ mi trắng, quần xanh) và đồ thường ngày dựng từ quần áo có sẵn của MPFB2, đổi màu và
  texture. Đồ đi làm ở chương 4 là đồ thường ngày đổi texture áo. Kịch bản hiện tại không cần áo dài.

### 8.3 Bối cảnh

- Dựng trong Blender, vật liệu CC0 (Poly Haven, ambientCG), dùng mô hình CC0 khi hợp. Đồ vật riêng của Việt Nam tự
  dựng hoặc tạo bằng công cụ AI tạo 3D (kiểm điều khoản thương mại của từng công cụ).
- Ánh sáng nướng bằng Cycles thành lightmap: UV thứ hai, một atlas cho cả bối cảnh. Texture màu dùng chung cho mọi
  kiểu ánh sáng; mỗi kiểu ánh sáng chỉ thêm một lightmap (tối đa 2 kiểu mỗi bối cảnh, mục 6.5).
- Một bối cảnh có nhiều cách bày bằng các nhóm `bt_<cach_bay>` (mục 7.4). Đồ của từng cách bày dùng ánh sáng
  realtime hoặc lightmap riêng, không nướng vào atlas chung của bối cảnh.
- Đồ vật hình khối đơn giản (quầy, kệ, bàn ghế, máy photocopy) dựng tay trong Blender thường nhanh hơn tạo bằng AI rồi
  sửa. Công cụ AI tạo 3D dành cho đồ có hình dạng phức tạp (nồi cơm điện, xe máy, chậu cây).

### 8.4 Xuất và nén

Blender → `.glb` → gltf-transform: nén hình học bằng Meshopt; texture KTX2 (ETC1S cho phần lớn, UASTC cho normal map
và mặt nhân vật); ra hai bộ 1K và 2K. Lightmap xuất riêng thành KTX2 (glTF chưa có chuẩn cho lightmap); lúc nạp
bối cảnh, code gán lightmap theo kiểu ánh sáng trong tag `# den`. Một script trong module chạy toàn bộ các bước này.

### 8.5 Bản quyền

- Chỉ dùng asset CC0, CC-BY (có ghi công), hoặc mua kèm giấy phép dùng trong game web.
- Mọi asset bên ngoài ghi vào `assets/LICENSES.md` (nguồn, giấy phép, ghi công). Màn "Giới thiệu & bản quyền" đọc từ
  file này.
- Asset tạo bằng công cụ AI cũng ghi vào đó: tên công cụ, ngày tạo, điều khoản sử dụng đầu ra tại ngày đó, và có phải
  ghi công không. Chỉ dùng đầu ra của công cụ mà điều khoản cho phép dùng trong game phát hành công khai.

### 8.6 Asset tạm

Bản thử đầu (vertical slice) dùng nhân vật và bối cảnh tạm (asset CC0, khối hộp) để chứng minh kỹ thuật trước khi đầu
tư đồ họa thật.

### 8.7 Lưu file nặng

File nguồn (`.blend`, ảnh gốc) không đưa vào git. Asset đã nén để trong module khi còn nhỏ; tổng vượt khoảng 50 MB thì
chuyển sang Git LFS hoặc R2 (quyết lúc đó).

### 8.8 Âm thanh

- Nhạc: thư viện CC0 hoặc có giấy phép dùng trong game (ghi ở `LICENSES.md`). Nhạc tạo bằng AI chỉ dùng khi điều khoản
  của công cụ cho phép như mục 8.5.
- Hiệu ứng: Freesound (lọc CC0), Kenney (CC0), và tự thu bằng điện thoại: tiếng máy photocopy, mưa trên mái tôn, xe
  máy, trống trường, loa ga. Tự thu là cách vừa thật vừa không vướng bản quyền.
- Định dạng MP3 (nhạc 128 kbps, hiệu ứng mono 96 kbps), chuẩn hóa độ to về khoảng −16 LUFS.

### 8.9 Ảnh kỷ niệm và chữ trong cảnh

- Ảnh mở bằng `# anh` (ảnh lớp, ảnh tấm biển, ảnh đồ án) chụp từ chính cảnh 3D trong game: dựng tư thế, đặt camera,
  xuất ảnh, thêm lớp màu phim. Nhân vật trong ảnh vì thế giống nhân vật lúc chơi. Không dùng ảnh AI có người.
- Chữ trên biển, giấy tờ, màn hình điện thoại làm bằng Krita hoặc Inkscape với font có giấy phép OFL đủ dấu tiếng Việt,
  không để công cụ AI vẽ chữ.
- Công cụ AI tạo ảnh dùng cho tham khảo phong cách, texture không có người, tranh treo tường, bao bì đồ vật.

## 9. Kiểm thử

- **Logic (Vitest)**: lưu, nạp, khôi phục save; chọn mức đồ họa và hạ mức; kiểm tên; tách người nói và tag; Director
  chọn đúng truyện đang mở.
- **Kịch bản (Vitest, inkjs headless)**:
  - toàn bộ Ink biên dịch không lỗi, không cảnh báo;
  - chơi thử ngẫu nhiên hàng nghìn lượt với seed cố định: không có chỗ kẹt (hết lựa chọn mà chưa tới kết), chỉ số luôn
    trong 0–100, `buoi_ranh` không bao giờ âm;
  - tiền không bao giờ âm; lựa chọn có `#khoa` không bao giờ được chọn;
  - mỗi kết thúc có một lượt chơi mẫu viết sẵn đi tới được (kết nào có nhiều đường thì mỗi đường một lượt);
  - các hàm luật của kịch bản (xét tuyển, chọn kết) cho đúng từng dòng trong bảng của kịch bản;
  - mọi tag `# den` trỏ tới bối cảnh có thật; mọi mã người nói có trong danh sách nhân vật; mọi truyện phụ mở được trong
    ít nhất một lượt.
- **Chạy thật**: smoke test trên trình duyệt (vào game, nhập tên, đi, thoại, lưu, tải lại trang); đo FPS trên 3 máy
  thật: PC, iPhone, Android tầm trung.

## 10. Triển khai (phase cuối)

Theo cách của `kira-memory-ui`: image nginx phát `dist/`, chạy trên VPS sau Cloudflare. Cần đúng MIME cho `.glb`,
`.ktx2`, `.wasm`; cache 1 năm cho file có hash; nén gzip/brotli cho JS, JSON, WASM. Tên miền và CI quyết khi tới phase
này.

## 11. Cấu trúc thư mục dự kiến

```
kira-game/
  AGENTS.override.md   quy tắc module, lệnh verify
  README.md
  docs/
    design.md          tài liệu này
    plan.md            lộ trình và kế hoạch Phase 1
    plan-story.md      Phase 2: chuyển kịch bản sang Ink
    plan-art.md        Phase 4: đồ họa và âm thanh
    story/             kịch bản bản viết (Markdown, Codex viết) và bản review
  story/               kịch bản bản chạy (Ink)
  src/                 code game (TypeScript)
  assets/              asset đã nén + LICENSES.md
  tools/               script nén asset, biên dịch Ink
  test/                test logic và kịch bản
  package.json, vite.config.ts, tsconfig.json
```

Module chỉ có một app web nên code nằm thẳng trong `kira-game/`, không tách thư mục con như `kira-memory`.

## 12. Các quyết định thiết kế đã đưa ra (chủ dự án soát lại)

Chủ dự án đã chốt: hướng A, render ở client, đồ họa thích ứng, chương hai lớp (chính + phụ), thời gian có hạn, hậu quả
xuyên chương, truyện hư cấu, chọn giới tính nhân vật chính, người yêu khác giới có hai bản, bối cảnh Việt Nam thời nay,
4 chương, 2–3 giờ, 3–4 kết thúc, tự làm đồ họa và âm thanh bằng asset miễn phí và công cụ AI.

Các quyết định dưới đây do người viết thiết kế đưa ra:

1. **Giao diện bằng DOM thường, không Angular/React.** UI mỏng; framework làm nặng bản tải và giành vòng render.
2. **Ink làm định dạng kịch bản chạy**; Markdown của Codex được chuyển sang Ink sau khi duyệt.
3. **Chỉ số ẩn**, phản hồi bằng lời và nhật ký quan hệ.
4. **Hoạt động lặp lại** (học, gọi về nhà, hẹn hò, làm thêm) để chia thời gian thành lựa chọn thật mà không cần viết
   thêm nhiều truyện.
5. **Đồ họa tự động chỉ hạ, không tự nâng** (lý do ở mục 7.5); điện thoại mặc định tối đa Vừa.
6. **Một bản lưu tự động + điểm lưu đầu mỗi chương**, thay vì nhiều ô lưu tay.
7. **Điện thoại chỉ chơi màn hình ngang.**
8. **Mức nội dung 13+** và các quy tắc ở mục 6.6.
9. **Giới hạn 12 bối cảnh, 10 mô hình nhân vật có tên** (mục 6.5).
10. **Công cụ và asset miễn phí** (MPFB2, Mixamo, CC0) cộng công cụ AI. Nếu bản thử phong cách cho thấy nhân vật chưa
    đủ "thật", giảm cận mặt và dựa vào ánh sáng, góc máy, thay vì mua công cụ.
11. **Triển khai giống `kira-memory-ui`** (nginx, VPS, Cloudflare).
12. **Tối đa 2 kiểu ánh sáng mỗi bối cảnh**, nướng thành lightmap riêng để texture màu dùng chung (mục 6.5, 8.3).
13. **Tối đa 6 cử chỉ hai người** cho cả game (mục 6.5, 8.2).
14. **Phần chữ ngoài cảnh** (nhật ký, tóm tắt chương, hoạt động, tin nhắn, câu hỏi, tên kết thúc): người viết chưa giao
    thì Claude viết lúc chuyển sang Ink (mục 6.7).
15. **Máy chuẩn để đặt ngân sách** (mục 7.6).

Các quyết định thêm khi khớp thiết kế với kịch bản "Chừa một dòng" (lý do ở `docs/story/review.md`):

16. **Một buổi rảnh sau mỗi cảnh chính 1–5; hoạt động làm một lần mỗi chương** và mở từ điện thoại (mục 5.2).
17. **Tiền hiện trong Ví**; phương án thiếu tiền hiện khóa kèm giá; phương án cần chỉ số ẩn thì ẩn (mục 5.3, 7.3).
18. **Truyện bắt đầu bằng cuộc gọi hay tin nhắn mở từ điện thoại** (`# o: dien_thoai`), không cần điểm neo 3D.
19. **Cách bày bối cảnh** bằng nhóm `bt_<cach_bay>` và tham số thứ ba của `# den` (mục 7.4), để bớt bối cảnh phải
    dựng.
20. **Dựng cả game chơi được bằng khối hộp trước đồ họa thật.** Lộ trình đổi thứ tự: Phase 3 là các hệ thống còn
    thiếu, Phase 4 là đồ họa (`docs/plan.md`). Cân nhịp chơi và kết thúc trên bản khối hộp rẻ hơn nhiều so với sửa đồ
    họa đã làm.
21. **Ảnh kỷ niệm chụp từ cảnh 3D trong game**; không dùng ảnh AI có người (mục 8.9).
22. **Nhãn người nói của người yêu là "Khánh"** ở cả hai bản; tên đầy đủ qua `{ten_ny()}` (mục 6.3).

### Câu hỏi đã trả lời

**Ai làm đồ họa 3D và âm thanh?** Chủ dự án tự làm, dùng asset miễn phí và công cụ AI (trả lời ngày 2026-11-27).
Hệ quả: không mua asset hay công cụ; đồ họa thu nhỏ theo `docs/story/review.md` mục 4.3 (8 bối cảnh, 6 mô hình có
tên); kế hoạch đồ họa ở `docs/plan-art.md`. Chưa nêu hạn chót.

## 13. Để người build tự quyết

- Cấu trúc file trong `src/`, tên class và hàm.
- Phiên bản thư viện cụ thể.
- Thông số camera, tốc độ đi, độ nhạy điều khiển.
- Thông số chính xác của từng mức đồ họa, miễn nằm trong ngân sách mục 7.5–7.6.
- Giao diện chi tiết: màu, font cụ thể (trong các font đủ dấu tiếng Việt).
