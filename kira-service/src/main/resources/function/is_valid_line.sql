DELIMITER //
DROP FUNCTION IF EXISTS is_valid_line //
CREATE FUNCTION is_valid_line(line VARCHAR(50))
    RETURNS BOOLEAN
    DETERMINISTIC
BEGIN
    DECLARE is_hdc BOOLEAN;
    SET is_hdc = INSTR(line, '#') > 0;

    IF is_hdc THEN
        RETURN line REGEXP '^[-+]?[0-9]+(\.(0|25|5|75))?(/[-+]?[0-9]+(\.(0|25|5|75))?)?#[-+]?[0-9]+(\.(0|25|5|75))?(\/[-+]?[0-9]+(\.(0|25|5|75))?)?$';
    ELSE
        RETURN line REGEXP '^[-+]?[0-9]+(\.(0|25|5|75))?(/[-+]?[0-9]+(\.(0|25|5|75))?)?$';
    END IF;
END //

DELIMITER ;
