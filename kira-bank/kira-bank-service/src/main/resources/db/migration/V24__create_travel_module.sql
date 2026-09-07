CREATE TABLE travel_trips (
    id CHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    data JSON NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_travel_owner FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_travel_owner (user_id, updated_at)
);

CREATE TABLE travel_files (
    id CHAR(36) PRIMARY KEY,
    trip_id CHAR(36) NOT NULL,
    name VARCHAR(180) NOT NULL,
    content_type VARCHAR(40) NOT NULL,
    size_bytes INT NOT NULL,
    content MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_travel_file_trip FOREIGN KEY (trip_id) REFERENCES travel_trips(id) ON DELETE CASCADE,
    INDEX idx_travel_file_trip (trip_id)
);
