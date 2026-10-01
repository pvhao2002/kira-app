-- Doi Nang farm market: full schema. Money is BIGINT VND. Timestamps are UTC DATETIME(6).

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_phone UNIQUE (phone),
  CONSTRAINT ck_users_role CHECK (role IN ('CUSTOMER','STAFF','MANAGER','ADMIN')),
  CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','LOCKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  family_id CHAR(36) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  replaced_by_hash CHAR(64) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX ix_refresh_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(8) NOT NULL,
  name VARCHAR(120) NOT NULL,
  short_name VARCHAR(60) NOT NULL,
  address VARCHAR(255) NOT NULL,
  hours VARCHAR(40) NOT NULL,
  open_flag TINYINT(1) NOT NULL DEFAULT 1,
  theme_primary CHAR(7) NOT NULL,
  theme_accent CHAR(7) NOT NULL,
  manager_name VARCHAR(120) NULL,
  phone VARCHAR(20) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_branches_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_branch_assignments (
  user_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, branch_id),
  CONSTRAINT fk_uba_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_uba_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_categories_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A "similar group" links equivalent products across branches (same item, different branch price/stock).
CREATE TABLE product_groups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  CONSTRAINT uq_product_groups_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  group_id BIGINT NULL,
  category_id BIGINT NOT NULL,
  sku VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  description TEXT NULL,
  origin VARCHAR(160) NULL,
  image_url VARCHAR(500) NULL,
  badge VARCHAR(40) NULL,
  price BIGINT NOT NULL,
  old_price BIGINT NULL,
  unit VARCHAR(20) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  suggest_to_other_branches TINYINT(1) NOT NULL DEFAULT 1,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  sold_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_products_branch_sku UNIQUE (branch_id, sku),
  CONSTRAINT uq_products_slug UNIQUE (slug),
  CONSTRAINT ck_products_price CHECK (price >= 0 AND (old_price IS NULL OR old_price >= 0)),
  CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE','DRAFT','HIDDEN')),
  CONSTRAINT fk_products_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_products_group FOREIGN KEY (group_id) REFERENCES product_groups (id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  INDEX ix_products_group (group_id),
  INDEX ix_products_branch_status (branch_id, status),
  INDEX ix_products_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  on_hand INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id),
  CONSTRAINT ck_inventory_on_hand CHECK (on_hand >= 0),
  CONSTRAINT ck_inventory_reserved CHECK (reserved >= 0 AND reserved <= on_hand),
  CONSTRAINT fk_inventory_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only stock ledger. Never UPDATE or DELETE rows.
CREATE TABLE inventory_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  type VARCHAR(16) NOT NULL,
  delta INT NOT NULL,
  on_hand_after INT NOT NULL,
  reason VARCHAR(255) NULL,
  ref_type VARCHAR(32) NULL,
  ref_id VARCHAR(64) NULL,
  actor_user_id BIGINT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT ck_inv_mov_type CHECK (type IN ('RECEIPT','ADJUSTMENT','SALE','RETURN')),
  CONSTRAINT fk_inv_mov_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_inv_mov_product FOREIGN KEY (product_id) REFERENCES products (id),
  INDEX ix_inv_mov_product (product_id, created_at),
  INDEX ix_inv_mov_branch (branch_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE addresses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  label VARCHAR(40) NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  ward VARCHAR(80) NULL,
  district VARCHAR(80) NULL,
  city VARCHAR(80) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  nearest_branch_id BIGINT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_addresses_branch FOREIGN KEY (nearest_branch_id) REFERENCES branches (id),
  INDEX ix_addresses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(24) NOT NULL,
  user_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(16) NOT NULL,
  payment_status VARCHAR(16) NOT NULL DEFAULT 'UNPAID',
  shipping_method VARCHAR(16) NOT NULL,
  shipping_fee BIGINT NOT NULL DEFAULT 0,
  subtotal BIGINT NOT NULL,
  discount BIGINT NOT NULL DEFAULT 0,
  points_used INT NOT NULL DEFAULT 0,
  points_discount BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL,
  promo_code VARCHAR(40) NULL,
  voucher_code VARCHAR(40) NULL,
  ship_recipient VARCHAR(120) NOT NULL,
  ship_phone VARCHAR(20) NOT NULL,
  ship_line1 VARCHAR(255) NOT NULL,
  ship_ward VARCHAR(80) NULL,
  ship_district VARCHAR(80) NULL,
  ship_city VARCHAR(80) NULL,
  customer_note VARCHAR(500) NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  tracking_code VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_orders_code UNIQUE (code),
  CONSTRAINT uq_orders_user_idem UNIQUE (user_id, idempotency_key),
  CONSTRAINT ck_orders_status CHECK (status IN ('PENDING','CONFIRMED','PREPARING','SHIPPING','DELIVERED','CANCELLED')),
  CONSTRAINT ck_orders_money CHECK (shipping_fee >= 0 AND subtotal >= 0 AND discount >= 0 AND total >= 0),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  INDEX ix_orders_user (user_id, created_at),
  INDEX ix_orders_branch_status (branch_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku VARCHAR(40) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price BIGINT NOT NULL,
  quantity INT NOT NULL,
  line_total BIGINT NOT NULL,
  CONSTRAINT ck_order_items_qty CHECK (quantity > 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id),
  INDEX ix_order_items_order (order_id),
  INDEX ix_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only.
CREATE TABLE order_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  actor_user_id BIGINT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  INDEX ix_osh_order (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  author_user_id BIGINT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_order_notes_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_notes_author FOREIGN KEY (author_user_id) REFERENCES users (id),
  INDEX ix_order_notes_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  type VARCHAR(16) NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  min_order BIGINT NOT NULL DEFAULT 0,
  max_discount BIGINT NULL,
  starts_at DATETIME(6) NOT NULL,
  ends_at DATETIME(6) NOT NULL,
  usage_limit INT NULL,
  per_user_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  all_branches TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_promotions_code UNIQUE (code),
  CONSTRAINT ck_promotions_type CHECK (type IN ('PERCENT','FIXED','FREE_SHIP')),
  CONSTRAINT ck_promotions_value CHECK (value >= 0 AND (type <> 'PERCENT' OR value <= 100)),
  CONSTRAINT ck_promotions_dates CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_branches (
  promotion_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  PRIMARY KEY (promotion_id, branch_id),
  CONSTRAINT fk_pb_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE CASCADE,
  CONSTRAINT fk_pb_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_redemptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  promotion_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  discount BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_redemption_order UNIQUE (promotion_id, order_id),
  CONSTRAINT fk_redemption_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id),
  CONSTRAINT fk_redemption_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_redemption_order FOREIGN KEY (order_id) REFERENCES orders (id),
  INDEX ix_redemption_user (promotion_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wishlist_items (
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  rating TINYINT NOT NULL,
  body VARCHAR(2000) NULL,
  has_photo TINYINT(1) NOT NULL DEFAULT 0,
  photo_url VARCHAR(500) NULL,
  reply_body VARCHAR(2000) NULL,
  reply_by_user_id BIGINT NULL,
  replied_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_reviews_user_product_order UNIQUE (user_id, product_id, order_id),
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_reviews_reply_by FOREIGN KEY (reply_by_user_id) REFERENCES users (id),
  INDEX ix_reviews_product (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only points ledger. balance = SUM(delta) of non-expired rows. Awards are idempotent via the unique key.
CREATE TABLE loyalty_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  delta INT NOT NULL,
  reason VARCHAR(32) NOT NULL,
  ref_type VARCHAR(32) NOT NULL,
  ref_id VARCHAR(64) NOT NULL,
  expires_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_loyalty_ref UNIQUE (ref_type, ref_id, reason),
  CONSTRAINT fk_loyalty_user FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX ix_loyalty_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vouchers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  discount_type VARCHAR(16) NOT NULL,
  value BIGINT NOT NULL,
  min_order BIGINT NOT NULL DEFAULT 0,
  points_cost INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',
  expires_at DATETIME(6) NULL,
  used_order_id BIGINT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_vouchers_code UNIQUE (code),
  CONSTRAINT ck_vouchers_type CHECK (discount_type IN ('PERCENT','FIXED','FREE_SHIP')),
  CONSTRAINT ck_vouchers_status CHECK (status IN ('AVAILABLE','USED','EXPIRED')),
  CONSTRAINT fk_vouchers_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_vouchers_order FOREIGN KEY (used_order_id) REFERENCES orders (id),
  INDEX ix_vouchers_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
