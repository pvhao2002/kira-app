-- Run once on primary DB (kira). Tables for manual credit-card tracking (no bank API).

CREATE TABLE IF NOT EXISTS credit_cards (
    credit_card_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT          NOT NULL,
    bank_name           VARCHAR(128) NOT NULL,
    card_label          VARCHAR(256) NOT NULL,
    last_four           CHAR(4)      NULL,
    credit_limit        DECIMAL(15, 2) NOT NULL,
    outstanding_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cardholder_name     VARCHAR(128) NOT NULL,
    statement_day       TINYINT      NOT NULL,
    payment_due_day     TINYINT      NOT NULL,
    reminder_time       TIME         NOT NULL,
    cycle_statement_done TINYINT(1)  NOT NULL DEFAULT 0,
    cycle_due_paid      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_credit_cards_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_card_payments (
    payment_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    credit_card_id   BIGINT         NOT NULL,
    user_id          INT            NOT NULL,
    paid_at          DATE           NOT NULL,
    amount           DECIMAL(15, 2) NOT NULL,
    note             TEXT           NULL,
    created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ccp_card (credit_card_id),
    INDEX idx_ccp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
