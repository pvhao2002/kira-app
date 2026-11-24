-- Picks priced 1.65 or lower pay too little: the prediction prompt must not choose them. Added to the general step 7
-- and to step 5 of the LIVE and PRE_MATCH rules, which rank the candidates and take precedence over the general steps.
-- replace() only changes the default text, so admin edits are kept; the version bump records a new version (V16
-- trigger). Keep dollar-brace pairs out of this file: Flyway would read them as placeholders.

UPDATE prompt_templates
SET content = replace(replace(replace(content,
        $a$7. Pick the TWO selections with the highest estimated winning probability (rank 1 and rank 2).
$a$,
        $a$7. Pick the TWO selections with the highest estimated winning probability (rank 1 and rank 2).
   PRICE FLOOR: never pick a selection whose own decimal price is 1.65 or lower (e.g. AH HOME at 1.60): the
   price is too short to be worth it. Drop it and take the next selection priced above 1.65. If only one
   selection is priced above 1.65, send that one pick alone and say why in metadata.notes. If none is, do not
   append a row: reply with the single line NO_PICK_PRICE_TOO_LOW.
$a$),
        $b$   liệu cho agent gọi và dừng gửi callback.
$b$,
        $b$   liệu cho agent gọi và dừng gửi callback.
   Không chọn kèo có giá (odds của chính lựa chọn đó, dòng Live) nhỏ hơn hoặc bằng 1.65: giá quá thấp. Bỏ kèo
   đó, lấy kèo kế tiếp có giá lớn hơn 1.65, theo PRICE FLOOR ở bước 7.
$b$),
        $c$   cuộc xuất hiện nhiều nhất; xác suất là số thập phân từ 0 đến 1.
$c$,
        $c$   cuộc xuất hiện nhiều nhất; xác suất là số thập phân từ 0 đến 1.
   Không chọn kèo có giá (odds của chính lựa chọn đó, dòng PRE_MATCH) nhỏ hơn hoặc bằng 1.65: giá quá thấp.
   Bỏ kèo đó, lấy kèo kế tiếp có giá lớn hơn 1.65, theo PRICE FLOOR ở bước 7.
$c$),
    version = version + 1,
    updated_at = now()
WHERE template_type = 'AI_PREDICTION'
  AND position('7. Pick the TWO selections with the highest estimated winning probability' IN content) > 0
  AND position('PRICE FLOOR' IN content) = 0;
