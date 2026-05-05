CREATE TABLE IF NOT EXISTS transaction_images (
    image_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id      BIGINT NOT NULL,
    user_id             INT NOT NULL,
    image_base64        LONGTEXT NOT NULL,
    content_type        VARCHAR(50) NULL,
    file_name           VARCHAR(255) NULL,
    ai_model            VARCHAR(100) NULL,
    ai_raw_response     LONGTEXT NULL,
    ai_parsed_response  LONGTEXT NULL,
    parse_status        ENUM('pending','processing','success','error') NOT NULL DEFAULT 'processing',
    parse_error         TEXT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX ux_transaction_images_transaction (transaction_id),
    INDEX idx_transaction_images_user (user_id),
    INDEX idx_transaction_images_parse_status (parse_status),
    INDEX idx_transaction_images_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
