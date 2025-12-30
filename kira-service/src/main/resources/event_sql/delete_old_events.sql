DELIMITER //
DROP EVENT IF EXISTS delete_old_events //
CREATE EVENT IF NOT EXISTS delete_old_events
    ON SCHEDULE EVERY 1 HOUR
        STARTS NOW()
    DO
    BEGIN
        DECLARE vn_now DATETIME;
        SET vn_now = CONVERT_TZ(NOW(), '+00:00', '+07:00');
        -- Xóa event cũ hơn 3 tiếng
        DELETE
        FROM events
        WHERE event_date < DATE_SUB(vn_now, INTERVAL 3 HOUR);

        DELETE
        FROM events
        WHERE event_date is null;

        DELETE
        FROM event_analyst
        WHERE event_date is null;
    END //
