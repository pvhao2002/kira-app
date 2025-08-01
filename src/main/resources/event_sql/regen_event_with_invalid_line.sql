DELIMITER //
DROP EVENT IF EXISTS regen_event_with_invalid_line //
CREATE EVENT IF NOT EXISTS regen_event_with_invalid_line
    ON SCHEDULE EVERY 1 DAY
        STARTS now()
    DO
    BEGIN
        insert ignore into event_crawl(event_name, event_date, detail_link)
        SELECT event_name, event_date, ea.link
        FROM invalid_line il
                 inner join odd_event oe on oe.line = il.line
                 inner join event_analyst ea on ea.event_id = oe.event_id
        group by ea.event_id;
    END //
