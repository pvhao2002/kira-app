ALTER TABLE user_credit_cards
  ADD COLUMN card_type VARCHAR(150) NULL AFTER bank_id;
