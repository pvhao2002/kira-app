-- Update only the seeded prediction note. Admin edits set updated_by.
UPDATE prompt_templates
SET content = replace(content, 'SETTLEMENT BASIS - CRITICAL',
$live$QUY TẮC RIÊNG CHO LIVE
Áp dụng phần này cho predictionType LIVE. Khi có khác biệt với các bước phân tích chung hoặc dữ liệu
minh họa bên dưới, ưu tiên quy tắc LIVE. Giữ định dạng JSON và các trường theo hợp đồng API.

1. Đọc odds theo thứ tự dòng 1 = OPENING, dòng 2 = PRE_MATCH, dòng 3 = LIVE, cùng ảnh Stats tại thời
   điểm Live. So sánh cả line và giá của AH, O/U bàn thắng (OU), O/U phạt góc (CORNER_OU) và 1X2 qua
   ba dòng để đánh giá kỳ vọng thị trường, tín hiệu nhất quán và biến động bất thường. Dùng Opening và
   Prematch để phân tích biến động. Chỉ dùng giá, line và oddsRef của dòng Live để chọn kèo. Odds giảm
   tự nó không chứng minh xác suất thắng thực tế tăng.
2. Đọc tỷ số, phút thi đấu, kiểm soát bóng, số cú sút, sút trúng đích, phạt góc, tấn công nguy hiểm,
   thẻ phạt, xG và các chỉ số khác nếu thấy rõ trên ảnh. Chỉ gửi các trường Stats được API hỗ trợ.
   Dùng dữ liệu được cung cấp, bỏ qua chỉ số thiếu hoặc không đọc được và không giả định sự kiện
   chưa xảy ra. Ưu tiên dữ liệu Live mới nhất, đối chiếu biến động odds với diễn biến trận đấu. Nếu
   ảnh và Live Odds lệch thời điểm, ghi rõ nguy cơ sai lệch trong metadata.notes. Nếu không xác định
   được hai nguồn có cùng thời điểm hay không, ghi rõ điều đó.
3. Kết hợp Live Odds với Stats thực tế để ước tính sức mạnh tấn công, phòng ngự và nhịp độ. Dùng mô
   hình xác suất phù hợp với trạng thái trận đấu để chạy đúng 1.000 lượt Monte Carlo, mô phỏng số bàn
   và số phạt góc còn lại khi có đủ dữ liệu. Cộng từng kết quả mô phỏng với tỷ số và số góc hiện tại
   tương ứng để ra kết quả chung cuộc. Ghi lại seed và chỉ báo simulationCount = 1000 khi đã chạy đủ.
4. Xác định phạm vi thanh toán từ dữ liệu kèo. Với AH Live FULL_MATCH, áp handicap vào tỷ số chung
   cuộc mô phỏng. Với AH Live REMAINING_MATCH, trừ tỷ số tại thời điểm odds được ghi nhận khỏi tỷ số
   chung cuộc mô phỏng theo từng đội rồi mới áp handicap. Dùng đúng scoreAtCapture của kèo, kể cả
   khi ảnh Stats chụp ở thời điểm khác. Loại kèo khỏi danh sách ứng viên nếu thiếu căn cứ xác định
   phạm vi thanh toán hoặc thiếu tỷ số/số góc lúc ghi nhận cho kèo REMAINING_MATCH. Bỏ các snapshot
   thiếu trường bắt buộc khỏi mảng odds trong JSON.
5. Xếp hạng các lựa chọn đủ dữ liệu thuộc AH, OU, CORNER_OU và 1X2 theo tỷ lệ lượt mô phỏng có kết
   quả WIN hoặc HALF_WIN, chia cho 1.000. Xử lý kèo châu Á theo ASIAN LINES bên dưới. Trả hai lựa
   chọn đứng đầu trong picks với rank 1 và 2. Nếu chỉ có một ứng viên, trả một kèo và ghi lý do
   trong metadata.notes. Nếu không có ứng viên hợp lệ hoặc không thể chạy mô phỏng, báo thiếu dữ
   liệu cho agent gọi và dừng gửi callback.
6. Đếm số lần xuất hiện của từng tỷ số chung cuộc. Trả đúng một tỷ số có tần suất cao nhất trong
   correctScore. Nếu đồng hạng, chọn theo thứ tự số bàn đội nhà tăng dần rồi số bàn đội khách tăng
   dần. Xác suất của tỷ số là số lần xuất hiện chia cho 1.000. Trong JSON, dùng số thập phân từ 0
   đến 1 cho mọi xác suất (ví dụ 58% là 0.58).

SETTLEMENT BASIS - CRITICAL$live$),
    version = version + 1,
    updated_at = now()
WHERE name = 'AI Football Prediction Prompt'
  AND template_type = 'AI_PREDICTION'
  AND updated_by IS NULL
  AND position('SETTLEMENT BASIS - CRITICAL' IN content) > 0
  AND position('QUY TẮC RIÊNG CHO LIVE' IN content) = 0;
