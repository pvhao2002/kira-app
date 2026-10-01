-- Tier perk discount is stored separately from promo/voucher discount so order totals stay auditable:
-- total = subtotal + shipping_fee - discount - tier_discount - points_discount.
ALTER TABLE orders ADD COLUMN tier_discount BIGINT NOT NULL DEFAULT 0 AFTER discount;
CREATE INDEX ix_orders_created ON orders (created_at);

-- Per-day counter behind order codes DN-yyMMdd-NNNN (allocated atomically with INSERT .. ON DUPLICATE KEY UPDATE).
CREATE TABLE order_sequences (
  day_key CHAR(6) NOT NULL PRIMARY KEY,
  seq_value INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
