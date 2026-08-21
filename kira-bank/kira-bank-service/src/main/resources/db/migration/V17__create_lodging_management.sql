CREATE TABLE lodging_reference_locations
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(500) NOT NULL,
  formatted_address VARCHAR(500),
  mapbox_id VARCHAR(255),
  longitude DECIMAL(10,7),
  latitude DECIMAL(10,7),
  geocode_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  geocode_error VARCHAR(80),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  FOREIGN KEY (created_by) REFERENCES users(id), INDEX idx_lodging_location_active (deleted_at, name)
);
CREATE TABLE lodging_listings
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  address VARCHAR(500) NOT NULL,
  formatted_address VARCHAR(500), mapbox_id VARCHAR(255), longitude DECIMAL(10,7), latitude DECIMAL(10,7),
  geocode_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', geocode_error VARCHAR(80),
  rent_price DECIMAL(19,4) NOT NULL,
  electricity_price DECIMAL(19,4), electricity_unit VARCHAR(30),
  water_price DECIMAL(19,4), water_unit VARCHAR(30),
  service_price DECIMAL(19,4), service_unit VARCHAR(30),
  parking_price DECIMAL(19,4), parking_unit VARCHAR(30),
  facebook_url VARCHAR(1000), phone VARCHAR(30), video_url VARCHAR(1000), note TEXT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  FOREIGN KEY (owner_id) REFERENCES users(id), INDEX idx_lodging_listing_active_updated (deleted_at, updated_at),
  INDEX idx_lodging_listing_owner (owner_id, deleted_at)
);
CREATE TABLE lodging_listing_locations
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT, listing_id BIGINT NOT NULL, reference_location_id BIGINT NOT NULL,
  distance_meters BIGINT, distance_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', distance_error VARCHAR(80), calculated_at TIMESTAMP(6),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  FOREIGN KEY (listing_id) REFERENCES lodging_listings(id), FOREIGN KEY (reference_location_id) REFERENCES lodging_reference_locations(id),
  UNIQUE KEY uk_lodging_listing_location (listing_id, reference_location_id), INDEX idx_lodging_listing_location_reference (reference_location_id, deleted_at)
);
CREATE TABLE lodging_listing_images
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT, listing_id BIGINT NOT NULL, attachment_id BIGINT NOT NULL, sort_order INT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  FOREIGN KEY (listing_id) REFERENCES lodging_listings(id), FOREIGN KEY (attachment_id) REFERENCES attachments(id),
  UNIQUE KEY uk_lodging_listing_image_attachment (attachment_id), UNIQUE KEY uk_lodging_listing_image_order (listing_id, sort_order),
  INDEX idx_lodging_listing_image_active (listing_id, deleted_at, sort_order)
);
CREATE TABLE lodging_reviews
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT, listing_id BIGINT NOT NULL, user_id BIGINT NOT NULL, status VARCHAR(10) NOT NULL, reason VARCHAR(1000),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  FOREIGN KEY (listing_id) REFERENCES lodging_listings(id), FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_lodging_review_user (listing_id, user_id), INDEX idx_lodging_review_listing (listing_id, deleted_at)
);
