DELIMITER //
DROP EVENT IF EXISTS delete_old_events //
CREATE EVENT IF NOT EXISTS delete_old_events
    ON SCHEDULE EVERY 1 DAY
        STARTS now()
    DO
    BEGIN
        DECLARE vn_now DATE;
        SET vn_now = DATE(CONVERT_TZ(CURDATE(), '+00:00', '+07:00'));

        DELETE
        FROM odds
        WHERE event_id IN (SELECT event_id
                           FROM events
                           WHERE DATE(CONVERT_TZ(event_date, '+00:00', '+07:00')) < vn_now);

        DELETE
        FROM events
        WHERE DATE(CONVERT_TZ(event_date, '+00:00', '+07:00')) < vn_now;

    END //
