DELIMITER //
DROP TRIGGER IF EXISTS trg_predict_detail_update //
CREATE TRIGGER trg_predict_detail_update
    BEFORE UPDATE
    ON predict_detail
    FOR EACH ROW
BEGIN
    -- Kiểm tra nếu có thay đổi về score, hdc_pick hoặc ou_pick
    IF NEW.predict_score <> OLD.predict_score
        OR NEW.hdc_pick <> OLD.hdc_pick
        OR NEW.ou_pick <> OLD.ou_pick
    THEN
        INSERT INTO predict_log (predict_type,
                                 predict_id,
                                 predict_score,
                                 hdc_pick,
                                 ou_pick,
                                 created_at,
                                 updated_at)
        VALUES (OLD.predict_type,
                OLD.predict_id,
                OLD.predict_score,
                OLD.hdc_pick,
                OLD.ou_pick,
                NOW(),
                NOW());
    END IF;
END//
