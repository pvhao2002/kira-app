CREATE TABLE tutoring_students
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  color CHAR(7) NOT NULL,
  note VARCHAR(1000),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  CONSTRAINT fk_tutoring_student_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_tutoring_student_owner (user_id, deleted_at, name)
);

CREATE TABLE tutoring_schedule_series
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  CONSTRAINT fk_tutoring_series_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_tutoring_series_owner (user_id, deleted_at)
);

CREATE TABLE tutoring_schedule_versions
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  series_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject VARCHAR(150) NOT NULL,
  teaching_mode VARCHAR(20) NOT NULL,
  location VARCHAR(500),
  fee DECIMAL(19,4) NOT NULL DEFAULT 0,
  note VARCHAR(2000),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  CONSTRAINT fk_tutoring_version_series FOREIGN KEY (series_id) REFERENCES tutoring_schedule_series(id),
  CONSTRAINT fk_tutoring_version_student FOREIGN KEY (student_id) REFERENCES tutoring_students(id),
  INDEX idx_tutoring_version_effective (series_id, deleted_at, effective_from, effective_to),
  INDEX idx_tutoring_version_student (student_id, deleted_at, effective_from),
  CHECK (day_of_week BETWEEN 1 AND 7),
  CHECK (start_time >= '06:00:00' AND end_time <= '23:00:00' AND end_time > start_time),
  CHECK (fee >= 0)
);

CREATE TABLE tutoring_lesson_exceptions
(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  series_id BIGINT NOT NULL,
  occurrence_date DATE NOT NULL,
  action VARCHAR(20) NOT NULL,
  moved_date DATE,
  moved_start_time TIME,
  moved_end_time TIME,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_by BIGINT,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), updated_by BIGINT,
  version BIGINT NOT NULL DEFAULT 0, deleted_at TIMESTAMP(6),
  CONSTRAINT fk_tutoring_exception_series FOREIGN KEY (series_id) REFERENCES tutoring_schedule_series(id),
  UNIQUE KEY uk_tutoring_exception_occurrence (series_id, occurrence_date),
  INDEX idx_tutoring_exception_date (occurrence_date, deleted_at),
  CHECK (action IN ('MOVE', 'CANCEL'))
);
