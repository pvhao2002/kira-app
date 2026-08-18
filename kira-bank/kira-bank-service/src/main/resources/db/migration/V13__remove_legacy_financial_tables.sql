-- Hard-delete retired investment transaction history before removing its parents.
DROP TABLE investment_task_settlements;
DROP TABLE investment_rewards;
DROP TABLE investment_withdrawals;
DROP TABLE investment_deposits;
DROP TABLE investment_ledger_entries;
DROP TABLE investment_tasks;

-- Hard-delete retired credit-card transaction, cashback, and discount history.
DROP TABLE cashback_records;
DROP TABLE card_transactions;
DROP TABLE discount_invoices;

DROP TABLE merchants;
DROP TABLE mccs;
DROP TABLE service_providers;

-- Investment accounts remain as profile records only.
ALTER TABLE investment_accounts
  DROP FOREIGN KEY investment_accounts_ibfk_2,
  DROP INDEX user_id,
  DROP CHECK investment_accounts_chk_1,
  DROP CHECK investment_accounts_chk_2,
  DROP CHECK investment_accounts_chk_3,
  DROP COLUMN platform_id,
  DROP COLUMN current_balance,
  DROP COLUMN available_capital,
  DROP COLUMN locked_capital,
  DROP COLUMN accumulated_profit,
  DROP COLUMN accumulated_reward,
  DROP COLUMN reserved_withdrawal;

DROP TABLE investment_platforms;
