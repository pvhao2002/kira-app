# Review kịch bản "Chừa một dòng"

> Người review: Claude · 2026-11-27 · Bản được review: `chua-mot-dong.md` (bản đầu của Codex).
> Đối chiếu với `docs/design.md` mục 6 (khung kịch bản).

## Kết luận

Dùng được làm kịch bản chính. Truyện có một motif chạy suốt bốn chương: tờ in hỏng có dòng "Lần tới gặp", vạch
nước ở bậc cửa, tấm biển XE ĐI HUẾ. Nhân vật có thói quen cụ thể. Lựa chọn nào cũng đổi một thứ lấy một thứ khác.
Bảng kết thúc phủ hết các trường hợp. Số chương, số cảnh, tỉ lệ buổi rảnh, cờ xuyên chương, giới hạn đồ họa và mức
nội dung đều nằm trong khung.

Trước khi chuyển sang Ink cần chốt 6 điểm ở mục 2. Mỗi điểm có sẵn một đề xuất. Nếu Codex không sửa thì lúc chuyển
Ink dùng đề xuất đó. Mục 3 trả lời ba câu Codex hỏi. Mục 4 là gợi ý nên làm nhưng không chặn việc chuyển Ink. Mục 5
là các quyết định phía thiết kế để khớp với kịch bản, đã cập nhật vào `design.md`.

## 1. Đối chiếu với khung

| Mục | Yêu cầu | Kịch bản | Kết quả |
|---|---|---|---|
| 6.1 | 4 chương: cấp 3, tình đầu, đại học, sau đại học | lớp 10–11, lớp 12, bốn năm đại học, năm thứ hai đi làm | Khớp |
| 6.2 | 5–6 cảnh chính | 6 cảnh mỗi chương | Khớp |
| 6.2 | 5–6 truyện phụ, mỗi truyện 1–3 phần | 5 truyện một phần mỗi chương | Khớp |
| 6.2 | Buổi rảnh khoảng 60–70% số việc đáng làm | 5 buổi trên 8 việc (5 truyện phụ, 3 hoạt động), tức 62,5% | Khớp |
| 6.2 | Ít nhất một truyện phụ có hậu quả ở chương sau | giúp Tú → C2, C4; so sổ tiền → C3; nhịp hẹn → C3, C4, kết; mốc nước → hậu truyện | Khớp |
| 6.2 | Mỗi cảnh ghi bối cảnh, nhân vật, thời điểm | có ở dòng nghiêng đầu cảnh | Khớp; nhiều cảnh thiếu giờ trong ngày (điểm 2.6) |
| 6.3 | Xưng hô qua hàm; cấp 3 dùng cậu/tớ | dùng `{toi_xung()}`, `{ny_xung()}`, `{ny_goi_toi()}`; đổi xưng hô sau `c2_chinh_1` | Khớp; hàm cần biết đã yêu hay chưa (mục 5) |
| 6.4 | Hiệu ứng ghi rõ, thường ±2 tới ±10 | đúng; tiền có mức lớn hơn vì là tiền, không phải chỉ số | Khớp |
| 6.4 | Mỗi kết thúc có điều kiện | bảng "Lời chọn cuối" phủ mọi trường hợp | Khớp |
| 6.5 | Tối đa 12 bối cảnh | 9 | Khớp |
| 6.5 | Tối đa 10 mô hình có tên | 7 | Khớp; chưa ghi giới tính Tú, Linh (điểm 2.5) |
| 6.5 | Tối đa 4 bộ đồ cho nhân vật chính, 2 cho nhân vật phụ | 3 và 2 | Khớp |
| 6.5 | Tối đa 2 kiểu ánh sáng mỗi bối cảnh, 16 cả game | chưa ghi | Thiếu; đề xuất ở mục 6 (13 kiểu) |
| 6.5 | Tối đa 6 cử chỉ hai người | 1 (nắm tay) | Khớp |
| 6.6 | 13+; chương 1–2 tối đa nắm tay, ôm, hôn nhẹ | chỉ nắm tay, Khánh hỏi trước | Khớp |
| 6.7 | Mã ổn định cho cảnh và truyện | có cho cảnh chính, truyện phụ, kết thúc; thiếu cho hoạt động | Thiếu (điểm 2.1) |
| 6.7 | Phần chữ ngoài cảnh | chưa có (mục 7) | Thiếu; Claude viết lúc chuyển Ink theo design §6.7 |

Kịch bản đang ở dạng tóm tắt cảnh và lựa chọn, chưa phải thoại từng dòng. Mức này hợp để review cốt truyện. Lúc
chuyển Ink, mỗi cảnh chính nở thành khoảng 20–40 dòng thoại và lời dẫn, mỗi truyện phụ 10–20 dòng (quy tắc ở
`docs/plan-story.md`).

## 2. Cần chốt trước khi chuyển Ink

### 2.1 Mã và lời cho hoạt động

Hoạt động chưa có mã. Đề xuất mỗi chương ba knot, đặt tên theo việc:

| Mã | Chương | Việc | Hiệu ứng (theo kịch bản) |
|---|---|---|---|
| `c<n>_hd_hoc` | 1–4 | C1–2 cùng Khánh ôn bài ở tiệm; C3 học nhóm rồi gọi kể Khánh nghe; C4 ở lại làm nốt bản đo | `[tinh_cam +2] [nang_luc +4]` |
| `c<n>_hd_me` | 1–4 | C1–3 gọi mẹ chốt giờ về; C4 sau cảnh 2 (đã về quê) đổi thành phụ mẹ trông tiệm | `[tinh_cam +2] [gia_dinh +4]` |
| `c<n>_hd_tu` | 1–2 | ngồi lại với Tú cho xong việc nhóm | `[tinh_cam +2] [ban_be +4]` |
| `c<n>_hd_ca` | 3–4 | nhận một ca có công sau khi báo giờ về | `[tinh_cam +2] [tien +60]` |

Lời cho Chương 3–4 phải đổi như cột "Việc": "cùng Khánh ôn bài" không hợp khi đã đi làm, "gọi mẹ chốt giờ về" không
hợp khi đang ở nhà ăn Tết. Mỗi hoạt động làm được một lần mỗi chương (đúng như kịch bản viết) và mở từ điện thoại ở
bất kỳ đâu, không cần điểm tương tác 3D (mục 5).

### 2.2 Ngưỡng "tình cảm đang thấp" ở `c3_chinh_6`

Cảnh có ba trường hợp: có `co_nhip_hen`; chưa có cờ và tình cảm thấp; còn lại. "Thấp" chưa có số. Đề xuất
`tinh_cam < 50`.

### 2.3 Số tiền điều kiện khác số tiền trừ

`c3_chinh_5`: đi xe buýt cần 50 nhưng trừ 20; đi tàu cần 250 nhưng trừ 220. Tiền là thứ người chơi thấy được (mục 5),
nên người chơi có 45 nghìn sẽ thấy "xe buýt 20 nghìn" mà không chọn được. Đề xuất lấy mức điều kiện làm giá: xe buýt
`[tien −50]`, tàu `[tien −250]` (gồm vé và ăn uống), và ghi giá đó trên lựa chọn. `c3_chinh_2` đã khớp (cần 30, trừ
30).

### 2.4 Cửa sổ mở, chỗ đặt và giờ của từng truyện phụ

Kịch bản viết "truyện phụ đã mở còn tới hết buổi rảnh cuối của chương, với lời dẫn cập nhật theo mốc hiện tại", nhưng
chưa ghi mỗi truyện mở từ lúc nào. Vài truyện lại gắn nhãn lớp ("Sân trường, lớp 10") trong khi vẫn mở tới lớp 11.
Đề xuất bảng dưới. "Mở sau" là số cảnh chính; truyện mở từ buổi rảnh sau cảnh đó tới buổi rảnh ở cột "Đóng sau".
"Điện thoại" nghĩa là truyện bắt đầu từ điện thoại ở bất kỳ đâu (cuộc gọi, tin nhắn). Lời dẫn của truyện mở qua nhiều
mốc thì viết không gắn lớp hoặc năm học.

| Mã | Mở sau | Đóng sau | Bối cảnh, ánh sáng | Điểm neo |
|---|---|---|---|---|
| `c1_phu_anh_uot` | 1 | 5 | `san_truong` ngày | `npc_tu` |
| `c1_phu_com_cho` | 4 | 5 | `tiem_photo` tối | `npc_me` |
| `c1_phu_chu_tren_bien` | 3 | 5 | `ben_xe` chiều | `npc_bac_che` |
| `c1_phu_da_cau` | 3 | 5 | `san_truong` chiều | `diem_da_cau` |
| `c1_phu_vach_nuoc` | 3 | 5 | `tiem_photo` ngày, mưa | `diem_bac_cua` |
| `c2_phu_de_thu` | 1 | 5 | `lop_hoc` ngày | `diem_ban_hoc` (trước thi khi `buoc_chinh ≤ 2`, sau thi khi lớn hơn) |
| `c2_phu_so_tien` | 4 | 5 | `tiem_photo` tối | `diem_so_sach` |
| `c2_phu_tu_hoc_nghe` | 1 | 2 | `san_truong` ngày | `npc_tu` (chỉ trước thi) |
| `c2_phu_cho_o` | 3 | 5 | điện thoại | — |
| `c2_phu_in_thu` | 1 | 5 | `tiem_photo` ngày | `diem_may_in` |
| `c3_phu_bep_tro` | 1 | 5 | `phong_tro` tối | `diem_bep` |
| `c3_phu_chu_thu` | 3 | 5 | điện thoại (bỏ xưởng, điểm 4.3) | — |
| `c3_phu_ca_in` | 2 | 5 | `tiem_photo` bày thành tiệm in gần trường, ngày | `npc_dong_nghiep` |
| `c3_phu_muoi_lam_phut` | 4 | 4 | điện thoại | — |
| `c3_phu_gio_sua` | 3 | 5 | điện thoại | — |
| `c4_phu_moc_nuoc` | 2 | 5 | `tiem_photo` bày Tết, ngày | `diem_bac_cua` |
| `c4_phu_bua_sang` | 2 | 5 | `quan_ghe_nhua` ngày | `npc_tu` |
| `c4_phu_anh_ban_giao` | 1 | 1 | điện thoại | — |
| `c4_phu_doi_ca` | 1 | 1 | `van_phong` chiều | `npc_dong_nghiep` |
| `c4_phu_hop_de` | 2 | 5 | `tiem_photo` bày Tết, ngày | `diem_hop_giay` |

Hai truyện `c4_phu_anh_ban_giao` và `c4_phu_doi_ca` chỉ có buổi rảnh sau cảnh 1 (lúc còn ở thành phố, trước Tết) nên
người chơi chỉ làm được một trong hai. Đó là lựa chọn hợp lý, không cần sửa.

### 2.5 Giới tính Tú và Linh

Cần để làm mô hình. Đề xuất Tú là nam, Linh là nữ. Linh có thể là NPC chung có tên thay vì mô hình riêng (điểm 4.3).

### 2.6 Giờ trong ngày của mỗi cảnh

Mỗi cảnh cần một kiểu ánh sáng có sẵn ở bối cảnh đó (design §6.5). Đề xuất ở mục 6. Cảnh có mưa (`c1_chinh_1`,
`c1_chinh_3`, `c1_phu_vach_nuoc`) dùng hiệu ứng mưa chồng lên kiểu ngày hoặc chiều.

## 3. Trả lời ba câu Codex hỏi

### 3.1 Dấu vết của lý do tới Huế

Có hai đường tới Huế. Đường A: xếp Đà Nẵng trước nhưng thiếu điểm (22–23 vào Huế, dưới 22 vào trường dự phòng).
Đường B: tự xếp Huế trước. `c2_chinh_6` tách hai đường rất rõ ("bấm làm mới trang một lần nữa", "Cái này tớ vẫn được
học"). Từ Chương 3 trở đi, hai đường dùng chung một bản chữ, nên người đi đường A không còn thấy mình đã muốn ở Đà
Nẵng. Cần giữ dấu vết ở ba cảnh, mỗi chỗ một hai câu:

1. `c3_chinh_1`. Đường A: [Tên] mở lại ảnh xưởng vật liệu đã lưu từ tháng ba rồi tắt đi, hoặc Khánh vô tình gửi ảnh
   chính cái xưởng ấy. Đường B: lịch đi khảo sát thoát nước dán trên tủ lạnh nhà dì.
2. `c3_chinh_4` (chờ ở ga). Đường B: [Tên] đã chọn học xa nên nghĩ mình phải chịu được chờ, và giận chính ý nghĩ đó.
   Đường A: không chọn xa mà vẫn phải chờ. Đặt câu này vào cuộc gọi.
3. `c3_chinh_6`. Đường A: trang báo cáo thực địa chính là dòng [Tên] đã chỉ vào hôm có kết quả ("Cái này tớ vẫn được
   học"); cảnh khép lại đường A ở đây. Trường dự phòng: báo cáo của ngành gần. Đường B: báo cáo khảo sát thoát nước.

Nên có thêm ở `c4_chinh_4`: tấm biển XE ĐI HUẾ đọc khác nhau. Đường A: "Hồi đó tớ không định đi chuyến này." Đường B:
"Tớ đã chọn chuyến này."

Trong Ink, hai đường phân biệt bằng `xep_truoc` và `noi_hoc` (mục 5).

### 3.2 Cảnh chờ ở quán và ở ga

Quán ở Đà Nẵng có một hình ảnh cụ thể và không cần lời: cô chủ quán hâm lại bát canh bên kia bàn rồi đặt nắp lên. Giữ
nguyên.

Ga Huế còn chung chung: "loa đã báo tàu tới, người đón đã tản gần hết" đúng với ga nào cũng được. Đề xuất cho ga một vật
cụ thể như bát canh. [Tên] đang làm ở tiệm in, nên có thể đã in sẵn bảng giờ tàu cho cả hai (nối với `c3_chinh_1`, khi
hai đứa so giờ tàu với lịch học). Chuyến tàu có Khánh đi qua, sân ga vắng, [Tên] gấp bảng giờ lại. Hình ảnh này nối với
motif tờ giấy.

Thoại trong cuộc gọi đúng nhưng còn chung. Kịch bản giới thiệu Khánh "hay nói 'kịp' ngay cả khi đang lo mình sẽ trễ",
nhưng chưa cảnh nào dùng thói quen đó. Đề xuất biến nó thành dấu hiệu bốn năm đại học đã đổi hai người:

- `c3_chinh_4`: trưa hôm đó Khánh nhắn "Kịp mà". Trong cuộc gọi, [Tên] hỏi: "Lúc nhắn 'kịp', {ny_xung()} đã biết là
  không kịp à?"
- `c3_chinh_6` khi có `co_nhip_hen`: Khánh nhắn từ trưa "Hôm nay không kịp, mình dời sang tối mai nhé." Khánh đã học
  được cách báo sớm. Khi không có cờ, Khánh vẫn nói "kịp".
- `ket_2` đã có sẵn "Khánh báo ngay từ trưa", khớp với thay đổi này.

[Tên] cũng có một thói quen chưa được dùng: "hay tự nhận thêm việc trước khi hỏi mẹ có cần mình làm hay không". Các lựa
chọn nhận ca ở Chương 3 chính là thói quen đó, nhưng chưa có lúc nào [Tên] nhận ra. Đề xuất đặt vào `c4_chinh_2`: mẹ
nói "Con vẫn nhận việc trước rồi mới hỏi", ngay trước câu hỏi về chuyện cưới.

### 3.3 Kết 2 bằng hai cách; kết 3 và kết 4

Kết 2 cần: học ở Huế, có lịch chung (`co_nhip_hen` hoặc `co_ke_hoach_chung`), và `tinh_cam ≥ 70` sau khi cộng +5 của
"Thử tiếp" (tức là ít nhất 65 trước lựa chọn cuối).

- Ít tiền: "Hẹn gọi 15 phút" ở `c3_chinh_5` luôn mở, cho `co_nhip_hen` và +5. Cũng có thể lấy cờ từ
  `c3_phu_muoi_lam_phut`, hoặc lấy `co_ke_hoach_chung` ở `c4_chinh_5`.
- Đủ tiền: đi tàu ở `c3_chinh_5` cho `co_nhip_hen` và +8.

Cả hai cách đều tới kết 2. Chênh nhau 3 điểm tình cảm, không đáng kể. `tinh_cam` bắt đầu ở 32; người chơi chăm chút
có thể lên khoảng 80 ngay từ hết Chương 2, nên mốc 65 dễ đạt với người hay chọn ở bên nhau và khó với người hay nhận
ca. Phase 2 có hai lượt chơi viết sẵn cho hai cách này, và explorer đo tỉ lệ từng kết thúc.

Kết 3 và kết 4 đã có dư âm riêng. Kết 3 khép lại có lời: khóc, rồi tự tay gấp tờ giấy. Câu "Hồi đó mình còn nợ tiền
viết mặt sau" nối đúng với "Có. Lần tới trả." ở `c2_chinh_1`. Kết 4 không khép: tin nhắn gõ rồi xóa, nếp gấp không
còn giữ được. Chỗ trùng duy nhất là tấm biển ở bến. Bản `tinh_cam ≤ 35` của kết 3 có ảnh biển sửa xong, và kết 4 cũng có
ảnh biển. Người chơi lại lần hai sẽ thấy lặp. Đề xuất bỏ ảnh biển khỏi kết 3, cho kết 3 dừng ở ngăn kéo tiệm dưới xấp
giấy thử màu, và giữ tấm biển cho kết 4, nơi nó hợp với chủ đề thói quen.

Đối chiếu số cảnh, cờ và bối cảnh: đã làm ở mục 1. Còn một chỗ: `co_moc_nuoc` hứa một dòng hậu truyện ("mẹ nhắn nước
đã rút qua chỗ [Tên] đánh dấu") nhưng chưa nói ở kết nào. Đề xuất thêm dòng đó vào cuối cả bốn kết.

## 4. Nên sửa (không chặn)

1. **Cảnh chính không có lựa chọn.** `c1_chinh_5`, `c1_chinh_6`, `c2_chinh_3`, `c4_chinh_1`, `c4_chinh_3`,
   `c4_chinh_4` chưa có lựa chọn nào. Đề xuất mỗi cảnh một lựa chọn bày tỏ, không có hiệu ứng hoặc chỉ +2, để cảnh
   chính nào người chơi cũng được làm gì đó. Hai chỗ đáng có nhất: `c1_chinh_6` (viết gì dưới dòng Huế) và `c4_chinh_4`
   (làm gì với tờ giấy cũ).
2. **Hiệu ứng không dùng tới ở lựa chọn cuối.** "Nói lời chia tay" và "Dời sang hôm khác" luôn ra kết 3 và kết 4, nên
   `[tinh_cam +2] [gia_dinh +4]` và `[tinh_cam −7] [tien +120]` không làm đổi gì. Đề xuất bỏ, hoặc để hậu truyện kết 4
   nhắc tới những tối nhận kín việc.
3. **Bớt tài nguyên cho người làm một mình.** Bỏ xưởng thiết kế: `c3_phu_chu_thu` thành cuộc gọi ở cả hai tuyến,
   phương án gặp ở `c3_chinh_5` diễn ra ở quán hoặc phòng trọ. Còn 8 bối cảnh. Linh chỉ xuất hiện bằng xương bằng thịt
   ở `c3_chinh_3` tuyến Đà Nẵng, ngồi trong nhóm, nên có thể dùng NPC chung có tên. Còn 6 mô hình có tên.
4. **Tên người thật ở mục "Chất liệu từ chuyện có thật".** Giữ link bài báo, bỏ họ tên những người được kể. Họ là người
   bình thường, không phải nhân vật công chúng, và repo có thể công khai. Không đưa phần này vào game hay màn bản quyền.
5. **Thứ tự nguyện vọng hiện cho hiệu ứng giống nhau** (`c2_chinh_5`, cả hai `[tinh_cam +3] [gia_dinh +3]`). Giữ được
   vì không phạt hướng nào. Nếu muốn người chơi thấy cái giá của mỗi hướng: xếp Huế trước thì thêm `[gia_dinh +2]` (mẹ
   yên tâm vì có dì Thanh), xếp Đà Nẵng trước thì thêm `[tinh_cam +2]`.
6. **Nhân vật phụ có thoại nhưng không có mô hình riêng:** bác bán chè, cô chủ quán, chủ tiệm in, đồng nghiệp. Dùng NPC
   chung và có tên hiển thị khi nói.

## 5. Quyết định phía thiết kế (đã cập nhật `design.md`)

- Hàm xưng hô biết đã yêu hay chưa qua cờ `co_yeu_nhau`, bật ở cuối `c2_chinh_1`. Trước đó trả về cậu/tớ. Có thêm bản
  viết hoa cho đầu câu: `{Ny_xung()}`, `{Toi_xung()}`, `{Ny_goi_toi()}`, `{Toi_goi_ny()}`.
- `[Tên]` thành `{ten}`. Nhãn người nói của `ny` là "Khánh" ở cả hai bản. Tên đầy đủ lấy bằng `{ten_ny()}` ("Minh
  Khánh" khi người chơi là nữ, "An Khánh" khi người chơi là nam).
- Biến của tuyến truyện: `diem_thi`; `xep_truoc` (`"da_nang"` hoặc `"hue"`); `noi_hoc` (`"da_nang"`, `"hue"`,
  `"hue_du_phong"`). Hàm Ink `chot_diem()` chạy ở đầu `c2_chinh_3`, `xet_tuyen()` ở `c2_chinh_6`, `chon_ket(loi_chon)`
  ở `c4_chinh_6`. Mỗi hàm có test theo đúng các bảng trong kịch bản.
- Sau mỗi cảnh chính 1–5 có đúng một buổi rảnh. Hoạt động làm được một lần mỗi chương.
- Tiền đổi bằng phép gán, không qua `doi()`, và không bao giờ âm. Phương án cần tiền mà không đủ vẫn hiện, bị khóa, kèm
  giá. Phương án cần chỉ số ẩn (ví dụ `gia_dinh ≥ 60`) thì ẩn hẳn, để chỉ số vẫn ẩn. Tiền hiện ở mục Ví trong điện
  thoại từ Chương 3.
- Chữ trên nút lựa chọn tối đa khoảng 60 ký tự. Phần mô tả dài trong kịch bản thành các dòng thoại ngay sau lựa chọn.
- Mini-game là lớp phủ 2D trên màn hình, không cần animation 3D.
- Một bối cảnh có thể có nhiều cách bày (tiệm nhà và tiệm in gần trường, tiệm ngày thường và ngày Tết, phòng trọ và góc
  phòng nhà dì) qua tham số thứ ba của `# den`.

## 6. Bối cảnh và kiểu ánh sáng đề xuất

| Mã | Bối cảnh | Kiểu ánh sáng | Cách bày | Dùng ở |
|---|---|---|---|---|
| `tiem_photo` | Tiệm photocopy nhà [Tên] | ngày, tối | thường, Tết, tiệm in gần trường | C1 cảnh 1, 4, 6; C2 cảnh 2, 4, 5, 6; C4 cảnh 2, 3; nhiều truyện phụ |
| `lop_hoc` | Lớp học | ngày | — | C1 cảnh 2; `c2_phu_de_thu` |
| `san_truong` | Sân trường | ngày, chiều | — | C1 cảnh 5; C2 cảnh 3; truyện phụ C1, C2 |
| `ben_xe` | Bến xe Bến Dâu | ngày, chiều | thường, Tết | C1 cảnh 3; C2 cảnh 6; C4 cảnh 4, 6; các kết |
| `quan_ghe_nhua` | Quán ghế nhựa | ngày, tối | Bến Dâu, quán cơm Đà Nẵng | C2 cảnh 1; C3 cảnh 3, 4 (Đà Nẵng); C4 cảnh 5; kết 1 |
| `phong_tro` | Phòng ở sinh viên | ngày, tối | phòng trọ, góc phòng nhà dì | C3 cảnh 1, 2, 3 (Huế), 5, 6 |
| `ga_hue` | Ga Huế | tối | — | C3 cảnh 4 (Huế) |
| `van_phong` | Văn phòng khảo sát | chiều | — | C4 cảnh 1; `c4_phu_doi_ca` |

Tổng 13 kiểu ánh sáng (giới hạn 16). Nếu giữ xưởng thiết kế thì thêm một bối cảnh, một kiểu ánh sáng.

## 7. Phần chữ ngoài cảnh còn thiếu

Claude viết lúc chuyển Ink, theo giọng của kịch bản; chủ dự án duyệt.

- Nhật ký quan hệ: bốn chỉ số, mỗi chỉ số 3–4 mức, mỗi mức một câu.
- Thẻ cuối chương: bốn thẻ, mỗi thẻ hai ba câu.
- Lời hoạt động: mỗi hoạt động hai ba biến thể cho mỗi chương có nó.
- Câu hỏi giải đề: khoảng 15 câu trắc nghiệm ngắn, mức lớp 12.
- Một dòng tóm tắt cho mỗi kết thúc (màn "Kết thúc đã mở").
- Nhãn thời điểm cho HUD, lấy từ dòng đầu mỗi cảnh (ví dụ "Lớp 10 · Tháng mười").
