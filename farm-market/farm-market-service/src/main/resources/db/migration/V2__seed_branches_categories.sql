-- Reference data the app needs to work without the development seed. Branch ids are stable (1..5).
INSERT INTO branches (id, code, name, short_name, address, hours, open_flag, theme_primary, theme_accent, created_at, updated_at) VALUES
 (1, 'Q7', 'Quận 7 – Him Lam', 'Quận 7', '18 Nguyễn Thị Thập, P. Tân Hưng, Q.7', '6:00–21:00', 1, '#2e5233', '#f2d98a', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
 (2, 'Q3', 'Quận 3 – Võ Văn Tần', 'Quận 3', '122 Võ Văn Tần, P.6, Q.3', '6:00–21:00', 1, '#9a4a2a', '#f2d98a', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
 (3, 'TD', 'Thủ Đức – Thảo Điền', 'Thủ Đức', '35 Quốc Hương, P. Thảo Điền', '6:30–20:30', 1, '#1f5a5a', '#f0d58a', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
 (4, 'BT', 'Bình Thạnh – Phan Xích Long', 'Bình Thạnh', '201 Phan Xích Long, P.7', '6:00–21:00', 0, '#6b4a2b', '#f2c46a', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
 (5, 'DL', 'Đà Lạt – Phan Đình Phùng', 'Đà Lạt', '88 Phan Đình Phùng, P.2, Đà Lạt', '5:30–20:00', 1, '#3f4f7a', '#f2d98a', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO categories (slug, name, sort_order) VALUES
 ('ga', 'Gà', 1), ('trung', 'Trứng', 2), ('giacam', 'Gia cầm', 3),
 ('giasuc', 'Gia súc', 4), ('thucan', 'Thức ăn', 5), ('giong', 'Con giống', 6);
