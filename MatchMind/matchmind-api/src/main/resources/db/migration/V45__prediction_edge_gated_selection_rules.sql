-- Prod analysis 2026-11-27 (134 settled picks): the agent's probabilities added nothing to the bookmaker's price without
-- margin (Brier 0.247 vs the market's 0.237); it derived expected goals from the odds, so the simulation repeated the
-- market. V42's rules then forced a pick on every match: "rank 1 = highest probability in the window" plus "lower
-- yours by the TRACK RECORD gap" made 28 of 38 picks ones the agent itself rated below the market.
-- New SELECTION RULES: pick only when the expected return R from the simulation beats the market's by 0.10 and the
-- agent names an input the odds do not contain (INDEPENDENT DATA, live statistics); else NO_PICK_NO_EDGE. Asian quarter
-- lines are priced by what they pay: probability = (1 + R) / price. Steps 3, 6, 7, the LIVE and PRE_MATCH step 5, the
-- PRE_MATCH step 4, INPUT, MISSING DATA and both examples follow; the examples' numbers are exact Poisson results of
-- their own expected goals, so they pass the gate they show. Design: docs/superpowers/specs/2026-11-27-edge-gated-selection-rules-design.md.
-- All or nothing: a template is rewritten only when every old text below is in it, so an admin-edited prompt keeps
-- its text instead of new rules next to old steps. A template left alone is still on the old rules: after deploy,
-- SELECT id, version, position('NO_PICK_NO_EDGE' IN content) > 0 FROM prompt_templates WHERE template_type = 'AI_PREDICTION';
-- The version bump records a new version (V16 trigger). Keep dollar-brace pairs out of this file: Flyway would read
-- them as placeholders.

UPDATE prompt_templates t
SET content = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(t.content, v.rules_old, v.rules_new), v.input_old, v.input_new), v.step3_old, v.step3_new), v.step6_old, v.step6_new), v.step7_old, v.step7_new), v.missing_old, v.missing_new), v.live5_old, v.live5_new), v.pre4_old, v.pre4_new), v.pre5_old, v.pre5_new), v.live_ah_old, v.live_ah_new), v.live_stats_old, v.live_stats_new), v.live_goals_old, v.live_goals_new), v.live_probs_old, v.live_probs_new), v.live_scores_old, v.live_scores_new), v.live_picks_old, v.live_picks_new), v.pre_ah_old, v.pre_ah_new), v.pre_goals_old, v.pre_goals_new), v.pre_probs_old, v.pre_probs_new), v.pre_scores_old, v.pre_scores_new), v.pre_picks_old, v.pre_picks_new),
    version = t.version + 1,
    updated_at = now()
FROM (SELECT $q0$SELECTION RULES - TO WIN MORE OFTEN (apply to LIVE and PRE_MATCH; they win over the ranking steps there)
a. Price window. Only pick selections priced above 1.65 and at most 1.90 (the selection's own price on the
   snapshot you pick from). Never pick a selection priced above 1.90: in our record those won about 1 in 6, against
   7 in 10 inside the window. If no candidate is inside the window, do not append a row: reply with the single line
   NO_PICK_PRICE_OUT_OF_RANGE.
b. Rank 1 is the candidate inside the window with the highest simulated probability.
c. Rank 2 only when it is also inside the window and its probability is at least 0.60. Otherwise send rank 1 alone
   and say so in metadata.notes. Our rank 2 picks won far less often than rank 1.
d. Market check. Take the bookmaker's probability of the selection from the same snapshot, margin removed (q). If
   your probability p is more than 0.10 above q, re-check the line, the side, the settlement basis and the score at
   capture before you keep the pick. Most losing picks were ones rated far above the market at long prices.
e. Be honest. Do not round probabilities up. TRACK RECORD says how far off your past probabilities were: lower
   yours by that much.
f. Use TRACK RECORD. Skip a market/side listed under AVOID unless its probability is at least 0.65. When two
   candidates are within 0.03 of each other, take the one listed under FAVOUR.
$q0$ AS rules_old,
       $q0$SELECTION RULES - BET ONLY WITH A REAL EDGE (apply to LIVE and PRE_MATCH; they win over the ranking steps there)
Your simulation starts from the same odds as the bookmaker, so on its own it repeats the market and every pick loses
the bookmaker's margin. Pick only where you have an edge; skipping a match is the normal outcome.
a. Price window. Only selections priced above 1.65 and at most 1.90 (the selection's own price on the snapshot you
   pick from). If no candidate is inside the window, do not append a row: reply with the single line
   NO_PICK_PRICE_OUT_OF_RANGE.
b. For each candidate inside the window take, over the 1000 simulated finals, the shares that settle WIN (W),
   HALF_WIN (HW), HALF_LOSS (HL) and LOSS (L) under ASIAN LINES (PUSH counts 0), and compute:
   R = W * (price - 1) + HW * (price - 1) / 2 - HL / 2 - L   (your expected return per 1 unit staked)
   probability = (1 + R) / price   (send this as the pick's "probability"; without half results or pushes it is W)
   q = (1 / price) / (sum of 1 / price of every selection on that snapshot)   (the market, margin removed)
   M = q * price - 1   (the market's expected return, about minus its margin)
   edge = R - M
c. Name the reason. A gap to the market counts only when you can name an input the odds do not already contain:
   INDEPENDENT DATA (a line-up change or missing key player, recent form or xG, rest days, what a team plays for)
   or, for LIVE, the live statistics (shots on target, xG, dangerous attacks, a red card). Write that input and how
   much it moved your expected goals in metadata.notes. With no such input, edge = 0.
d. Keep a candidate only when edge >= 0.10 and R >= 0.03. Rank 1 is the kept candidate with the highest R.
e. Rank 2 only when it is also kept and in another market than rank 1. Otherwise send rank 1 alone.
f. Corner markets (CORNER_AH, CORNER_OU) only when the average corners of both teams were supplied.
g. If no candidate is kept, do not append a row: reply with the single line NO_PICK_NO_EDGE.
h. Never move a probability to fit TRACK RECORD. Use it to see where your past edges did not hold, and skip a
   market/side listed there under AVOID.
$q0$ AS rules_new,
       $q1$- OPTIONAL live statistics: possession, shots, shots on/off target, corners, yellow and red cards.
$q1$ AS input_old,
       $q1$- OPTIONAL live statistics: possession, shots, shots on/off target, corners, yellow and red cards.
- OPTIONAL INDEPENDENT DATA, what the odds do not already contain: confirmed line-ups and missing players, form
  of the last 5-10 matches (goals and xG for and against, home and away), standings and what each team plays for,
  rest days and the next fixture, average corners of both teams; for LIVE also xG, dangerous attacks and big
  chances. Send live xG and dangerous attacks in "stats.extra" as the LIVE example shows.
$q1$ AS input_new,
       $q2$3. Estimate the expected REMAINING goals for each team (and expected remaining corners when corner odds
   or corner stats exist).
$q2$ AS step3_old,
       $q2$3. Estimate the expected REMAINING goals for each team (and expected remaining corners when corner odds
   or corner stats exist). Start from what the odds imply, then move it only for INDEPENDENT DATA or live
   statistics, and write in metadata.notes which input moved it and by how much.
$q2$ AS step3_new,
       $q3$6. From the simulated final scores compute the win probability of every candidate pick:
$q3$ AS step6_old,
       $q3$6. From the simulated final scores settle every candidate pick in every iteration (WIN, HALF_WIN, PUSH,
   HALF_LOSS or LOSS):
$q3$ AS step6_new,
       $q4$7. Pick up to TWO selections (rank 1 and rank 2) as SELECTION RULES below says.
   PRICE FLOOR: never pick a selection whose own decimal price is 1.65 or lower (e.g. AH HOME at 1.60): the
   price is too short to be worth it. Drop it and take the next selection priced above 1.65. If only one
   selection is priced above 1.65, send that one pick alone and say why in metadata.notes. If none is, do not
   append a row: reply with the single line NO_PICK_PRICE_TOO_LOW.
$q4$ AS step7_old,
       $q4$7. Pick at most TWO selections (rank 1 and rank 2), only as SELECTION RULES below says. Often none qualifies:
   then do not append a row (NO_PICK_NO_EDGE).
$q4$ AS step7_new,
       $q5$read, and send the request anyway. Do not stop to ask the user for missing details.$q5$ AS missing_old,
       $q5$read, and send the request anyway. Do not stop to ask the user for missing details.
This is about fields you cannot read. Whether there is a pick at all is for SELECTION RULES: after
NO_PICK_NO_EDGE or NO_PICK_PRICE_OUT_OF_RANGE append no row.$q5$ AS missing_new,
       $q6$5. Xếp hạng các lựa chọn đủ dữ liệu thuộc AH, OU, CORNER_OU và 1X2 theo tỷ lệ lượt mô phỏng có kết
   quả WIN hoặc HALF_WIN, chia cho 1.000. Xử lý kèo châu Á theo ASIAN LINES bên dưới. Trả hai lựa
   chọn đứng đầu trong picks với rank 1 và 2. Nếu chỉ có một ứng viên, trả một kèo và ghi lý do
   trong metadata.notes. Nếu không có ứng viên hợp lệ hoặc không thể chạy mô phỏng, báo thiếu dữ
   liệu cho agent gọi và dừng gửi callback.
   Không chọn kèo có giá (odds của chính lựa chọn đó, dòng Live) nhỏ hơn hoặc bằng 1.65: giá quá thấp. Bỏ kèo
   đó, lấy kèo kế tiếp có giá lớn hơn 1.65, theo PRICE FLOOR ở bước 7.
$q6$ AS live5_old,
       $q6$5. Với mỗi lựa chọn đủ dữ liệu thuộc AH, OU, CORNER_OU và 1X2, đếm kết quả của nó trên 1.000 lượt mô phỏng
   theo ASIAN LINES bên dưới, tính probability, R và edge, rồi chọn hoặc bỏ qua theo SELECTION RULES (dùng giá,
   line và oddsRef của dòng Live). Nếu không thể chạy mô phỏng, báo thiếu dữ liệu cho agent gọi và dừng gửi
   callback.
$q6$ AS live5_new,
       $q7$   góc kỳ vọng từ odds phạt góc nếu có). Chạy đúng 1.000 lượt Monte Carlo cho cả 90 phút, bắt đầu từ 0-0:
$q7$ AS pre4_old,
       $q7$   góc kỳ vọng từ odds phạt góc nếu có). Sau đó chỉ điều chỉnh các con số này theo INDEPENDENT DATA (đội hình,
   chấn thương, phong độ/xG, lịch thi đấu, động lực) nếu được cung cấp, và ghi mức điều chỉnh trong
   metadata.notes. Chạy đúng 1.000 lượt Monte Carlo cho cả 90 phút, bắt đầu từ 0-0:
$q7$ AS pre4_new,
       $q8$5. Xếp hạng các lựa chọn đủ dữ liệu theo tỷ lệ lượt mô phỏng có kết quả WIN hoặc HALF_WIN trên kết quả cả
   trận, chia cho 1.000. Trả hai lựa chọn đứng đầu trong picks với rank 1 và 2. correctScore là tỷ số chung
   cuộc xuất hiện nhiều nhất; xác suất là số thập phân từ 0 đến 1.
   Không chọn kèo có giá (odds của chính lựa chọn đó, dòng PRE_MATCH) nhỏ hơn hoặc bằng 1.65: giá quá thấp.
   Bỏ kèo đó, lấy kèo kế tiếp có giá lớn hơn 1.65, theo PRICE FLOOR ở bước 7.
$q8$ AS pre5_old,
       $q8$5. Với mỗi lựa chọn đủ dữ liệu, đếm kết quả của nó trên 1.000 lượt mô phỏng cả trận, tính probability, R và
   edge, rồi chọn hoặc bỏ qua theo SELECTION RULES (dùng giá, line và oddsRef của dòng PRE_MATCH). Không có
   INDEPENDENT DATA thì mô phỏng chỉ lặp lại thị trường: trả NO_PICK_NO_EDGE. correctScore là tỷ số chung
   cuộc xuất hiện nhiều nhất; xác suất là số thập phân từ 0 đến 1.
$q8$ AS pre5_new,
       $q9$"lineDisplay": "0/-0.5", "homeOdds": 1.95, "awayOdds": 1.90, "settlementBasis": "REMAINING_MATCH",$q9$ AS live_ah_old,
       $q9$"lineDisplay": "0/-0.5", "homeOdds": 1.88, "awayOdds": 1.90, "settlementBasis": "REMAINING_MATCH",$q9$ AS live_ah_new,
       $q10$    "redCards": { "home": 0, "away": 0 }
  },
$q10$ AS live_stats_old,
       $q10$    "redCards": { "home": 0, "away": 0 },
    "extra": { "xg": { "home": 1.35, "away": 0.42 }, "dangerousAttacks": { "home": 38, "away": 21 } }
  },
$q10$ AS live_stats_new,
       $q11$"expectedRemainingGoals": { "home": 0.82, "away": 0.41 },$q11$ AS live_goals_old,
       $q11$"expectedRemainingGoals": { "home": 0.97, "away": 0.41 },$q11$ AS live_goals_new,
       $q12$"probabilities": { "1X2": { "HOME": 0.71, "DRAW": 0.20, "AWAY": 0.09 }, "OU_2.25": { "OVER": 0.54, "UNDER": 0.46 } },$q12$ AS live_probs_old,
       $q12$"probabilities": { "1X2": { "HOME": 0.85, "DRAW": 0.12, "AWAY": 0.03 }, "OU_2.25": { "OVER": 0.50, "UNDER": 0.51 } },$q12$ AS live_probs_new,
       $q13$"correctScoreDistribution": [ { "home": 1, "away": 0, "probability": 0.27 }, { "home": 2, "away": 0, "probability": 0.19 } ]$q13$ AS live_scores_old,
       $q13$"correctScoreDistribution": [ { "home": 1, "away": 0, "probability": 0.25 }, { "home": 2, "away": 0, "probability": 0.24 } ]$q13$ AS live_scores_new,
       $q14$    { "oddsRef": "ah-live", "market": "AH", "pick": "HOME", "probability": 0.58, "rank": 1 },
    { "oddsRef": "ou-live", "market": "OU", "pick": "OVER", "probability": 0.54, "rank": 2 }
  ],
  "correctScore": { "home": 1, "away": 0, "probability": 0.27 },
  "metadata": { "notes": "short reasoning summary" }
$q14$ AS live_picks_old,
       $q14$    { "oddsRef": "ah-live", "market": "AH", "pick": "HOME", "probability": 0.58, "rank": 1 }
  ],
  "correctScore": { "home": 1, "away": 0, "probability": 0.25 },
  "metadata": { "notes": "Shots on target 5-1 and live xG 1.35-0.42, not yet in the odds, raised home remaining goals from 0.70 to 0.97. AH HOME -0.25 at 1.88: R 0.093, market return -0.055, edge 0.148. OU 2.25: OVER edge -0.045 and UNDER edge 0.063, both skipped." }
$q14$ AS live_picks_new,
       $q15$"lineDisplay": "0/-0.5", "homeOdds": 1.92, "awayOdds": 1.96, "settlementBasis": "FULL_MATCH",$q15$ AS pre_ah_old,
       $q15$"lineDisplay": "0/-0.5", "homeOdds": 1.88, "awayOdds": 1.96, "settlementBasis": "FULL_MATCH",$q15$ AS pre_ah_new,
       $q16$"expectedRemainingGoals": { "home": 1.45, "away": 1.05 },$q16$ AS pre_goals_old,
       $q16$"expectedRemainingGoals": { "home": 1.65, "away": 1.05 },$q16$ AS pre_goals_new,
       $q17$"probabilities": { "1X2": { "HOME": 0.45, "DRAW": 0.27, "AWAY": 0.28 }, "OU_2.5": { "OVER": 0.52, "UNDER": 0.48 } },$q17$ AS pre_probs_old,
       $q17$"probabilities": { "1X2": { "HOME": 0.51, "DRAW": 0.25, "AWAY": 0.24 }, "OU_2.5": { "OVER": 0.51, "UNDER": 0.49 } },$q17$ AS pre_probs_new,
       $q18$"correctScoreDistribution": [ { "home": 1, "away": 1, "probability": 0.12 }, { "home": 1, "away": 0, "probability": 0.10 } ]$q18$ AS pre_scores_old,
       $q18$"correctScoreDistribution": [ { "home": 1, "away": 1, "probability": 0.12 }, { "home": 1, "away": 0, "probability": 0.11 } ]$q18$ AS pre_scores_new,
       $q19$    { "oddsRef": "ah-pre", "market": "AH", "pick": "HOME", "probability": 0.53, "rank": 1 },
    { "oddsRef": "ou-pre", "market": "OU", "pick": "OVER", "probability": 0.52, "rank": 2 }
  ],
  "correctScore": { "home": 1, "away": 1, "probability": 0.12 },
  "metadata": { "notes": "short reasoning summary" }
$q19$ AS pre_picks_old,
       $q19$    { "oddsRef": "ah-pre", "market": "AH", "pick": "HOME", "probability": 0.58, "rank": 1 }
  ],
  "correctScore": { "home": 1, "away": 1, "probability": 0.12 },
  "metadata": { "notes": "Confirmed line-up: both first-choice away centre-backs are out, which the pre-match odds did not price yet, so home goals raised from 1.45 to 1.65. AH HOME -0.25 at 1.88: R 0.088, market return -0.040, edge 0.129. Without that input: no pick." }
$q19$ AS pre_picks_new) v
WHERE t.template_type = 'AI_PREDICTION'
  AND position(v.rules_old IN t.content) > 0
  AND position(v.input_old IN t.content) > 0
  AND position(v.step3_old IN t.content) > 0
  AND position(v.step6_old IN t.content) > 0
  AND position(v.step7_old IN t.content) > 0
  AND position(v.missing_old IN t.content) > 0
  AND position(v.live5_old IN t.content) > 0
  AND position(v.pre4_old IN t.content) > 0
  AND position(v.pre5_old IN t.content) > 0
  AND position(v.live_ah_old IN t.content) > 0
  AND position(v.live_stats_old IN t.content) > 0
  AND position(v.live_goals_old IN t.content) > 0
  AND position(v.live_probs_old IN t.content) > 0
  AND position(v.live_scores_old IN t.content) > 0
  AND position(v.live_picks_old IN t.content) > 0
  AND position(v.pre_ah_old IN t.content) > 0
  AND position(v.pre_goals_old IN t.content) > 0
  AND position(v.pre_probs_old IN t.content) > 0
  AND position(v.pre_scores_old IN t.content) > 0
  AND position(v.pre_picks_old IN t.content) > 0
  AND position('NO_PICK_NO_EDGE' IN t.content) = 0;
