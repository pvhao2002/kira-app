ALTER TABLE user_credit_cards
  ADD COLUMN bank_id BIGINT NULL AFTER user_id,
  ADD COLUMN card_type VARCHAR(150) NULL AFTER bank_id;

UPDATE user_credit_cards user_card
  JOIN credit_card_catalogs catalog ON catalog.id = user_card.card_catalog_id
SET user_card.bank_id = catalog.bank_id,
    user_card.card_type = catalog.card_name;

ALTER TABLE user_credit_cards
  MODIFY COLUMN bank_id BIGINT NOT NULL,
  MODIFY COLUMN card_type VARCHAR(150) NOT NULL,
  DROP FOREIGN KEY user_credit_cards_ibfk_2,
  DROP COLUMN card_catalog_id,
  ADD INDEX idx_user_credit_cards_bank (bank_id),
  ADD CONSTRAINT fk_user_credit_cards_bank FOREIGN KEY (bank_id) REFERENCES banks (id);
