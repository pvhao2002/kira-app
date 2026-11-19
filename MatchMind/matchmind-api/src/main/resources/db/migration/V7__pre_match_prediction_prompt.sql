-- Before kick-off there are no live odds, no current score and no Stats screenshot. Add PRE_MATCH rules next to the
-- LIVE rules (V6) and a PRE_MATCH example the API accepts as is. Update only the seeded note: admin edits set updated_by.
UPDATE prompt_templates
SET content = replace(content, 'SETTLEMENT BASIS - CRITICAL',
$pre$QUY TẮC RIÊNG CHO PRE_MATCH (TRẬN CHƯA BẮT ĐẦU)
Áp dụng khi trận chưa bắt đầu: ảnh odds chỉ có dòng 1 = OPENING và dòng 2 = PRE_MATCH, không có dòng LIVE,
không có ảnh Stats, chưa có tỷ số và phút thi đấu. Đây là trường hợp bình thường: không yêu cầu thêm dữ liệu
Live và không tự tạo odds Live, Stats hay tỷ số. Khi có khác biệt với các bước phân tích chung hoặc dữ liệu
minh họa, ưu tiên quy tắc này. Giữ định dạng JSON và các trường theo hợp đồng API.

1. Gửi "predictionType": "PRE_MATCH" và "match.status": "SCHEDULED". Bỏ các trường matchMinute,
   currentScore, currentCorners và stats.
2. Chỉ dùng odds OPENING và PRE_MATCH. Không gửi snapshot odds có stage "LIVE" (API sẽ từ chối). Mọi
   snapshot dùng "settlementBasis": "FULL_MATCH", không có scoreAtCapture hay cornersAtCapture.
3. So sánh line và giá của AH, OU, CORNER_OU và 1X2 giữa OPENING và PRE_MATCH để đánh giá kỳ vọng thị
   trường, tín hiệu nhất quán và biến động bất thường. Chỉ dùng giá, line và oddsRef của dòng PRE_MATCH để
   chọn kèo. Odds giảm tự nó không chứng minh xác suất thắng thực tế tăng.
4. Bỏ biên lợi nhuận nhà cái, suy ra số bàn kỳ vọng của mỗi đội cho CẢ TRẬN từ giá 1X2, AH và OU (số phạt
   góc kỳ vọng từ odds phạt góc nếu có). Chạy đúng 1.000 lượt Monte Carlo cho cả 90 phút, bắt đầu từ 0-0:
   expectedRemainingGoals là số bàn kỳ vọng cả trận, parameters ghi "minutesRemaining": 90. Ghi lại seed và
   simulationCount = 1000.
5. Xếp hạng các lựa chọn đủ dữ liệu theo tỷ lệ lượt mô phỏng có kết quả WIN hoặc HALF_WIN trên kết quả cả
   trận, chia cho 1.000. Trả hai lựa chọn đứng đầu trong picks với rank 1 và 2. correctScore là tỷ số chung
   cuộc xuất hiện nhiều nhất; xác suất là số thập phân từ 0 đến 1.
6. Xem PRE_MATCH EXAMPLE ở cuối prompt.

SETTLEMENT BASIS - CRITICAL$pre$)
    || $tail$

PRE_MATCH EXAMPLE (trận chưa bắt đầu: không có odds Live, tỷ số hay Stats)
{
  "eventId": "provider-event-000124",
  "match": {
    "externalMatchId": "<provider match id>",
    "league": "English Premier League",
    "homeTeam": "Home FC",
    "awayTeam": "Away United",
    "startTime": "2026-11-21T15:00:00Z",
    "status": "SCHEDULED"
  },
  "predictionType": "PRE_MATCH",
  "predictedAt": "2026-11-21T12:00:00Z",
  "odds": [
    { "ref": "1x2-open", "market": "1X2", "stage": "OPENING", "snapshotOrder": 1,
      "homeOdds": 2.30, "drawOdds": 3.30, "awayOdds": 3.10, "settlementBasis": "FULL_MATCH",
      "capturedAt": "2026-11-19T09:00:00Z" },
    { "ref": "1x2-pre", "market": "1X2", "stage": "PRE_MATCH", "snapshotOrder": 1,
      "homeOdds": 2.15, "drawOdds": 3.40, "awayOdds": 3.30, "settlementBasis": "FULL_MATCH",
      "capturedAt": "2026-11-21T11:45:00Z" },
    { "ref": "ah-pre", "market": "AH", "stage": "PRE_MATCH", "snapshotOrder": 1, "line": -0.25,
      "lineDisplay": "0/-0.5", "homeOdds": 1.92, "awayOdds": 1.96, "settlementBasis": "FULL_MATCH",
      "capturedAt": "2026-11-21T11:45:00Z" },
    { "ref": "ou-pre", "market": "OU", "stage": "PRE_MATCH", "snapshotOrder": 1, "line": 2.5,
      "overOdds": 1.95, "underOdds": 1.90, "settlementBasis": "FULL_MATCH",
      "capturedAt": "2026-11-21T11:45:00Z" }
  ],
  "simulation": {
    "method": "MONTE_CARLO_POISSON",
    "simulationCount": 1000,
    "randomSeed": 515151,
    "expectedRemainingGoals": { "home": 1.45, "away": 1.05 },
    "algorithmVersion": "poisson-v1",
    "parameters": { "minutesRemaining": 90 },
    "probabilities": { "1X2": { "HOME": 0.45, "DRAW": 0.27, "AWAY": 0.28 }, "OU_2.5": { "OVER": 0.52, "UNDER": 0.48 } },
    "correctScoreDistribution": [ { "home": 1, "away": 1, "probability": 0.12 }, { "home": 1, "away": 0, "probability": 0.10 } ]
  },
  "picks": [
    { "oddsRef": "ah-pre", "market": "AH", "pick": "HOME", "probability": 0.53, "rank": 1 },
    { "oddsRef": "ou-pre", "market": "OU", "pick": "OVER", "probability": 0.52, "rank": 2 }
  ],
  "correctScore": { "home": 1, "away": 1, "probability": 0.12 },
  "metadata": { "notes": "short reasoning summary" }
}$tail$,
    version = version + 1,
    updated_at = now()
WHERE name = 'AI Football Prediction Prompt'
  AND template_type = 'AI_PREDICTION'
  AND updated_by IS NULL
  AND position('SETTLEMENT BASIS - CRITICAL' IN content) > 0
  AND position('QUY TẮC RIÊNG CHO PRE_MATCH' IN content) = 0;
