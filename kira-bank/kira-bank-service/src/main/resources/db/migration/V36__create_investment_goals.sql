CREATE TABLE investment_goals
(
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT         NOT NULL,
  currency      CHAR(3)        NOT NULL,
  period        VARCHAR(10)    NOT NULL,
  target_amount DECIMAL(19, 4) NOT NULL,
  created_at    TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_investment_goal_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT uq_investment_goal UNIQUE (user_id, currency, period),
  CONSTRAINT chk_investment_goal_period CHECK (period IN ('MONTH', 'YEAR')),
  CONSTRAINT chk_investment_goal_target CHECK (target_amount > 0)
);
