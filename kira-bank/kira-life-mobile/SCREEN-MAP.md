# Ánh xạ 24 màn hình

Tên mockup dưới đây là thư mục trong `../docs/mobile/Design UI UX`. Route có tham số sử dụng ID của dữ liệu ban đầu; có thể mở trực tiếp trên web hoặc đi từ nút trong app.

| # | Mockup | Route / trạng thái | Điểm vào |
|---|---|---|---|
| 1 | dashboard_th_t_n_d_ng | `/` | Tab Thẻ tín dụng |
| 2 | th_c_a_t_i | `/cards` | Thẻ của tôi |
| 3 | u_i_v_ho_n_ti_n | `/benefits` | Ưu đãi |
| 4 | c_nh_n_c_i_t | `/profile` | Tab Cá nhân |
| 5 | t_i_kho_n_u_t | `/investment` | Tab Đầu tư |
| 6 | nh_p_giao_d_ch_u_t | `/import` | Nhập giao dịch |
| 7 | h_ng_i_ai | `/queue` | Hàng đợi AI |
| 8 | th_m_t_i_kho_n_u_t | `/account-add` | Thêm tài khoản |
| 9 | ch_nh_s_a_t_i_kho_n_u_t | `/account-edit?id=ssi` | Chỉnh sửa tài khoản |
| 10 | xem_nh_ngu_n_ch_ng_t | `/source?id=job-1` | Xem ảnh |
| 11 | k_t_qu_ai_chu_n_h_a | `/ai-result?id=job-1` | Kết quả AI |
| 12 | ch_nh_s_a_b_n_ghi_giao_d_ch | `/draft-edit?id=draft-2` | Chỉnh sửa bản nháp |
| 13 | c_ch_x_l_giao_d_ch | `/decision?id=draft-2` | Thay đổi cách xử lý |
| 14 | k_t_qu_x_c_nh_n_m_t_ph_n | `/result-partial` | Xác nhận lô có xung đột |
| 15 | k_t_qu_x_c_nh_n_to_n_b | `/result-success` | Xác nhận hết các bản ghi |
| 16 | b_l_c_l_ch_s_giao_d_ch | `/filter` hoặc lớp phủ trong `/history` | Bộ lọc |
| 17 | l_ch_s_giao_d_ch_tr_ng | `/history`, kịch bản trống / không có kết quả | Cá nhân hoặc tìm kiếm |
| 18 | danh_s_ch_l_ch_s_giao_d_ch | `/history` | Lịch sử |
| 19 | chi_ti_t_giao_d_ch_l_ch_s | `/transaction-detail?id=tx-existing` | Chạm giao dịch |
| 20 | b_o_c_o_sai_l_ch_giao_d_ch | `/report-create?id=tx-existing` | Báo cáo sai lệch |
| 21 | chi_ti_t_gd_b_o_c_o_th_nh_c_ng_toast | `/report-success?id=tx-existing` | Sau khi gửi báo cáo; thông báo thành công giữ trên màn |
| 22 | danh_s_ch_b_o_c_o_sai_l_ch_khi_u_n_i | `/reports` | Báo cáo của tôi |
| 23 | th_ng_k_h_n_m_c_s_d_th_t_n_d_ng | `/credit-stats` | Thống kê tín dụng |
| 24 | th_ng_k_theo_t_ng_t_i_kho_n | `/account-stats?id=ssi` | Thống kê tài khoản |

Hai mẫu `b_l_c_l_ch_s_giao_d_ch_n_ng_cao` và `b_l_c_l_ch_s_giao_d_ch_to_n_trang` chỉ là tham khảo. V1 dùng cùng một bottom sheet. Các màn kết quả dùng dữ liệu xác nhận gần nhất; nên vào qua luồng xác nhận để có số liệu có ý nghĩa.

## Đối chiếu bản cập nhật 11/09/2026

24 trạng thái đã được dựng bằng thành phần React Native, với ảnh minh họa riêng lẻ lấy từ HTML và biểu đồ SVG native. `screen.png` không được dùng làm nền nguyên màn.

- Header Kira Bank, biểu tượng, avatar, ba tab và các thanh tác vụ đã cập nhật theo từng nhóm màn.
- Các màn sửa bản ghi, cách xử lý và báo cáo sử dụng bề mặt dạng sheet; bộ lọc là modal có vùng cuộn và nút áp dụng cố định.
- Công cụ chọn kịch bản nằm tại `/demo`, đã tách khỏi màn Cá nhân. Chọn nhóm **Mockup** để xem số liệu lịch sử, kết quả xác nhận và thống kê tương ứng ảnh nguồn.
- Dữ liệu tương tác đang lưu trên thiết bị được giữ khi nâng cấu trúc bộ lọc. Điều chỉnh hạn mức thẻ và hạn mức ngân hàng có phạm vi riêng, kèm lịch sử lý do cục bộ.

Bằng chứng và danh sách kiểm tra hiện tại: [VISUAL-QA.md](VISUAL-QA.md). Những ghi nhận kiểm tra của phiên bản trước đã được thay bằng kết quả của phiên bản hiện tại.

Không coi việc đủ route hoặc không lỗi JavaScript là chứng nhận giống hệt từng pixel. Bản native trên iPhone/Android thật, bàn phím hệ thống, phóng to chữ và hiệu ứng kính của thiết bị chưa được kiểm chứng trong lượt này.
