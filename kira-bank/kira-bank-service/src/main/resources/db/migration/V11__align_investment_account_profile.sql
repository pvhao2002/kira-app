-- Investment account profile fields were introduced in the application before
-- they were captured in a Flyway migration. Keep this migration compatible with
-- databases where Hibernate ddl-auto already created some or all of the columns.
DELIMITER //

DROP PROCEDURE IF EXISTS align_investment_account_profile//

CREATE PROCEDURE align_investment_account_profile()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'account_code'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN account_code VARCHAR(100) NULL AFTER platform_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'account_username'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN account_username VARCHAR(100) NULL AFTER external_account_code;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'account_email'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN account_email VARCHAR(150) NULL AFTER account_username;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN phone_number VARCHAR(50) NULL AFTER account_email;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'register_date'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN register_date DATE NULL AFTER phone_number;
  ELSE
    ALTER TABLE investment_accounts
      MODIFY COLUMN register_date DATE NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'investment_accounts'
      AND column_name = 'account_password'
  ) THEN
    ALTER TABLE investment_accounts
      ADD COLUMN account_password VARCHAR(100) NULL AFTER register_date;
  END IF;
END//

DELIMITER ;

CALL align_investment_account_profile();
DROP PROCEDURE align_investment_account_profile;
