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
    statement_cycle_id BIGINT       NULL,
    paid_at          DATE           NOT NULL,
    amount           DECIMAL(15, 2) NOT NULL,
    note             TEXT           NULL,
    created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ccp_card (credit_card_id),
    INDEX idx_ccp_user (user_id),
    INDEX idx_ccp_statement_cycle (statement_cycle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_card_mcc_categories (
    mcc_category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mcc_code CHAR(4) NOT NULL,
    category_name VARCHAR(160) NOT NULL,
    description TEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cc_mcc_user_code (user_id, mcc_code),
    INDEX idx_cc_mcc_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_card_cashback_rules (
    cashback_rule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    credit_card_id BIGINT NOT NULL,
    mcc_category_id BIGINT NOT NULL,
    cashback_rate DECIMAL(5,2) NOT NULL,
    monthly_cap_amount DECIMAL(15,2) NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cc_rule_start (credit_card_id, mcc_category_id, effective_from),
    INDEX idx_cc_rule_user_card_active (user_id, credit_card_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_card_statement_cycles (
    statement_cycle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    credit_card_id BIGINT NOT NULL,
    cycle_month DATE NOT NULL,
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    statement_amount DECIMAL(15,2) NULL,
    statement_issued_at DATETIME NULL,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cc_statement_cycle (user_id, credit_card_id, cycle_month),
    INDEX idx_cc_statement_user_due (user_id, due_date),
    INDEX idx_cc_statement_card_month (credit_card_id, cycle_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_card_cashback_transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    credit_card_id BIGINT NOT NULL,
    mcc_category_id BIGINT NULL,
    transaction_date DATE NOT NULL,
    customer_name VARCHAR(160) NULL,
    bill_reference VARCHAR(160) NULL,
    description VARCHAR(512) NULL,
    spend_amount DECIMAL(15,2) NOT NULL,
    discount_rate DECIMAL(5,2) NOT NULL,
    discount_amount DECIMAL(15,2) NOT NULL,
    cashback_rate_snapshot DECIMAL(5,2) NOT NULL,
    monthly_cap_snapshot DECIMAL(15,2) NULL,
    expected_cashback_amount DECIMAL(15,2) NOT NULL,
    actual_cashback_amount DECIMAL(15,2) NULL,
    cashback_due_date DATE NULL,
    cashback_received_at DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cc_tx_user_status_due (user_id, status, cashback_due_date),
    INDEX idx_cc_tx_card_date (credit_card_id, transaction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
