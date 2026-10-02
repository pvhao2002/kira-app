-- Query-driven indexes (EXPLAIN evidence in IndexExplainIT; everything else V1/V3 already indexes well).
--
-- Dashboard aggregates (revenue today/month, status counts, daily series) read only branch_id, created_at, status and
-- total of orders in a date window. Without this the optimizer range-scanned ix_orders_created and fetched every
-- matching row from the clustered index; this covering index narrows by branch first and answers from the index alone.
CREATE INDEX ix_orders_dashboard ON orders (branch_id, created_at, status, total);

-- "New customers today / this month" filters users by role and a created_at window; there was no usable index, so the
-- whole users table was scanned on every dashboard load.
CREATE INDEX ix_users_role_created ON users (role, created_at);
