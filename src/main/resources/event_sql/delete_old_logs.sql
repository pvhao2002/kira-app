DELIMITER //
DROP EVENT IF EXISTS delete_old_logs //
CREATE EVENT IF NOT EXISTS delete_old_logs
    ON SCHEDULE EVERY 1 DAY
        STARTS TIMESTAMP(CURRENT_DATE + INTERVAL 1 DAY)
    DO
    BEGIN
        DELETE
        FROM app_logs
        WHERE created_at < NOW() - INTERVAL 3 DAY;

    END //
