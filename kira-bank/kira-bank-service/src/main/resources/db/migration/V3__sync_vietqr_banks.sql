ALTER TABLE banks
  ADD COLUMN vietqr_id BIGINT,
  ADD COLUMN bin VARCHAR(20),
  ADD COLUMN swift_code VARCHAR(20),
  ADD COLUMN transfer_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN lookup_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT uk_banks_vietqr_id UNIQUE (vietqr_id),
  ADD INDEX idx_banks_bin (bin);

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO banks (
  vietqr_id,
  code,
  name,
  short_name,
  logo_url,
  bin,
  swift_code,
  transfer_supported,
  lookup_supported,
  active
)
VALUES
  (1, 'ABB', 'Ngân hàng TMCP An Bình', 'ABBANK', 'https://cdn.vietqr.io/img/ABB.png', '970425', 'ABBKVNVX', 1, 1, TRUE),
  (2, 'ACB', 'Ngân hàng TMCP Á Châu', 'ACB', 'https://cdn.vietqr.io/img/ACB.png', '970416', 'ASCBVNVX', 1, 1, TRUE),
  (3, 'BAB', 'Ngân hàng TMCP Bắc Á', 'BacABank', 'https://cdn.vietqr.io/img/BAB.png', '970409', 'NASCVNVX', 1, 1, TRUE),
  (4, 'BIDV', 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', 'BIDV', 'https://cdn.vietqr.io/img/BIDV.png', '970418', 'BIDVVNVX', 1, 1, TRUE),
  (5, 'BVB', 'Ngân hàng TMCP Bảo Việt', 'BaoVietBank', 'https://cdn.vietqr.io/img/BVB.png', '970438', 'BVBVVNVX', 1, 1, TRUE),
  (6, 'CBB', 'Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam', 'CBBank', 'https://cdn.vietqr.io/img/CBB.png', '970444', 'GTBAVNVX', 0, 1, TRUE),
  (7, 'CIMB', 'Ngân hàng TNHH MTV CIMB Việt Nam', 'CIMB', 'https://cdn.vietqr.io/img/CIMB.png', '422589', 'CIBBVNVN', 1, 1, TRUE),
  (8, 'DBS', 'DBS Bank Ltd - Chi nhánh Thành phố Hồ Chí Minh', 'DBSBank', 'https://cdn.vietqr.io/img/DBS.png', '796500', 'DBSSVNVX', 0, 0, TRUE),
  (9, 'Vikki', 'Ngân hàng TNHH MTV Số Vikki', 'Vikki', 'https://cdn.vietqr.io/img/Vikki.png', '970406', 'EACBVNVX', 0, 1, TRUE),
  (10, 'EIB', 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', 'Eximbank', 'https://cdn.vietqr.io/img/EIB.png', '970431', 'EBVIVNVX', 1, 1, TRUE),
  (11, 'GPB', 'Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu', 'GPBank', 'https://cdn.vietqr.io/img/GPB.png', '970408', 'GBNKVNVX', 0, 1, TRUE),
  (12, 'HDB', 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh', 'HDBank', 'https://cdn.vietqr.io/img/HDB.png', '970437', 'HDBCVNVX', 1, 1, TRUE),
  (13, 'HLBVN', 'Ngân hàng TNHH MTV Hong Leong Việt Nam', 'HongLeong', 'https://cdn.vietqr.io/img/HLBVN.png', '970442', 'HLBBVNVX', 0, 1, TRUE),
  (14, 'HSBC', 'Ngân hàng TNHH MTV HSBC (Việt Nam)', 'HSBC', 'https://cdn.vietqr.io/img/HSBC.png', '458761', 'HSBCVNVX', 0, 1, TRUE),
  (15, 'IBK - HN', 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội', 'IBKHN', 'https://cdn.vietqr.io/img/IBK.png', '970455', NULL, 0, 0, TRUE),
  (16, 'IBK - HCM', 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh', 'IBKHCM', 'https://cdn.vietqr.io/img/IBK.png', '970456', NULL, 0, 0, TRUE),
  (17, 'ICB', 'Ngân hàng TMCP Công thương Việt Nam', 'VietinBank', 'https://cdn.vietqr.io/img/ICB.png', '970415', 'ICBVVNVX', 1, 1, TRUE),
  (18, 'IVB', 'Ngân hàng TNHH Indovina', 'IndovinaBank', 'https://cdn.vietqr.io/img/IVB.png', '970434', NULL, 0, 1, TRUE),
  (19, 'KLB', 'Ngân hàng TMCP Kiên Long', 'KienLongBank', 'https://cdn.vietqr.io/img/KLB.png', '970452', 'KLBKVNVX', 1, 1, TRUE),
  (20, 'LPB', 'Ngân hàng TMCP Lộc Phát Việt Nam', 'LPBank', 'https://cdn.vietqr.io/img/LPB.png', '970449', 'LVBKVNVX', 1, 1, TRUE),
  (21, 'MB', 'Ngân hàng TMCP Quân đội', 'MBBank', 'https://cdn.vietqr.io/img/MB.png', '970422', 'MSCBVNVX', 1, 1, TRUE),
  (22, 'MSB', 'Ngân hàng TMCP Hàng Hải Việt Nam', 'MSB', 'https://cdn.vietqr.io/img/MSB.png', '970426', 'MCOBVNVX', 1, 1, TRUE),
  (23, 'NAB', 'Ngân hàng TMCP Nam Á', 'NamABank', 'https://cdn.vietqr.io/img/NAB.png', '970428', 'NAMAVNVX', 1, 1, TRUE),
  (24, 'NCB', 'Ngân hàng TMCP Quốc Dân', 'NCB', 'https://cdn.vietqr.io/img/NCB.png', '970419', 'NVBAVNVX', 1, 1, TRUE),
  (25, 'NHB HN', 'Ngân hàng Nonghyup - Chi nhánh Hà Nội', 'Nonghyup', 'https://cdn.vietqr.io/img/NHB.png', '801011', NULL, 0, 0, TRUE),
  (26, 'OCB', 'Ngân hàng TMCP Phương Đông', 'OCB', 'https://cdn.vietqr.io/img/OCB.png', '970448', 'ORCOVNVX', 1, 1, TRUE),
  (27, 'MBV', 'Ngân hàng TNHH MTV Việt Nam Hiện Đại', 'MBV', 'https://cdn.vietqr.io/img/MBV.png', '970414', 'OCBKUS3M', 1, 1, TRUE),
  (28, 'PBVN', 'Ngân hàng TNHH MTV Public Việt Nam', 'PublicBank', 'https://cdn.vietqr.io/img/PBVN.png', '970439', 'VIDPVNVX', 0, 1, TRUE),
  (29, 'PGB', 'Ngân hàng TMCP Thịnh vượng và Phát triển', 'PGBank', 'https://cdn.vietqr.io/img/PGB.png', '970430', 'PGBLVNVX', 1, 1, TRUE),
  (30, 'PVCB', 'Ngân hàng TMCP Đại Chúng Việt Nam', 'PVcomBank', 'https://cdn.vietqr.io/img/PVCB.png', '970412', 'WBVNVNVX', 1, 1, TRUE),
  (31, 'SCB', 'Ngân hàng TMCP Sài Gòn', 'SCB', 'https://cdn.vietqr.io/img/SCB.png', '970429', 'SACLVNVX', 1, 1, TRUE),
  (32, 'SCVN', 'Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam', 'StandardChartered', 'https://cdn.vietqr.io/img/SCVN.png', '970410', 'SCBLVNVX', 0, 1, TRUE),
  (33, 'SEAB', 'Ngân hàng TMCP Đông Nam Á', 'SeABank', 'https://cdn.vietqr.io/img/SEAB.png', '970440', 'SEAVVNVX', 1, 1, TRUE),
  (34, 'SGICB', 'Ngân hàng TMCP Sài Gòn Công Thương', 'SaigonBank', 'https://cdn.vietqr.io/img/SGICB.png', '970400', 'SBITVNVX', 1, 1, TRUE),
  (35, 'SHB', 'Ngân hàng TMCP Sài Gòn - Hà Nội', 'SHB', 'https://cdn.vietqr.io/img/SHB.png', '970443', 'SHBAVNVX', 1, 1, TRUE),
  (36, 'STB', 'Ngân hàng TMCP Sài Gòn Thương Tín', 'Sacombank', 'https://cdn.vietqr.io/img/STB.png', '970403', 'SGTTVNVX', 1, 1, TRUE),
  (37, 'SHBVN', 'Ngân hàng TNHH MTV Shinhan Việt Nam', 'ShinhanBank', 'https://cdn.vietqr.io/img/SHBVN.png', '970424', 'SHBKVNVX', 1, 1, TRUE),
  (38, 'TCB', 'Ngân hàng TMCP Kỹ thương Việt Nam', 'Techcombank', 'https://cdn.vietqr.io/img/TCB.png', '970407', 'VTCBVNVX', 1, 1, TRUE),
  (39, 'TPB', 'Ngân hàng TMCP Tiên Phong', 'TPBank', 'https://cdn.vietqr.io/img/TPB.png', '970423', 'TPBVVNVX', 1, 1, TRUE),
  (40, 'UOB', 'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh', 'UnitedOverseas', 'https://cdn.vietqr.io/img/UOB.png', '970458', NULL, 0, 1, TRUE),
  (41, 'VAB', 'Ngân hàng TMCP Việt Á', 'VietABank', 'https://cdn.vietqr.io/img/VAB.png', '970427', 'VNACVNVX', 1, 1, TRUE),
  (42, 'VBA', 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', 'Agribank', 'https://cdn.vietqr.io/img/VBA.png', '970405', 'VBAAVNVX', 1, 1, TRUE),
  (43, 'VCB', 'Ngân hàng TMCP Ngoại Thương Việt Nam', 'Vietcombank', 'https://cdn.vietqr.io/img/VCB.png', '970436', 'BFTVVNVX', 1, 1, TRUE),
  (44, 'VCCB', 'Ngân hàng TMCP Bản Việt', 'VietCapitalBank', 'https://cdn.vietqr.io/img/VCCB.png', '970454', 'VCBCVNVX', 1, 1, TRUE),
  (45, 'VIB', 'Ngân hàng TMCP Quốc tế Việt Nam', 'VIB', 'https://cdn.vietqr.io/img/VIB.png', '970441', 'VNIBVNVX', 1, 1, TRUE),
  (46, 'VIETBANK', 'Ngân hàng TMCP Việt Nam Thương Tín', 'VietBank', 'https://cdn.vietqr.io/img/VIETBANK.png', '970433', 'VNTTVNVX', 1, 1, TRUE),
  (47, 'VPB', 'Ngân hàng TMCP Việt Nam Thịnh Vượng', 'VPBank', 'https://cdn.vietqr.io/img/VPB.png', '970432', 'VPBKVNVX', 1, 1, TRUE),
  (48, 'VRB', 'Ngân hàng Liên doanh Việt - Nga', 'VRB', 'https://cdn.vietqr.io/img/VRB.png', '970421', NULL, 0, 1, TRUE),
  (49, 'WVN', 'Ngân hàng TNHH MTV Woori Việt Nam', 'Woori', 'https://cdn.vietqr.io/img/WVN.png', '970457', NULL, 1, 1, TRUE),
  (50, 'KBHN', 'Ngân hàng Kookmin - Chi nhánh Hà Nội', 'KookminHN', 'https://cdn.vietqr.io/img/KBHN.png', '970462', NULL, 0, 0, TRUE),
  (51, 'KBHCM', 'Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh', 'KookminHCM', 'https://cdn.vietqr.io/img/KBHCM.png', '970463', NULL, 0, 0, TRUE),
  (52, 'COOPBANK', 'Ngân hàng Hợp tác xã Việt Nam', 'COOPBANK', 'https://cdn.vietqr.io/img/COOPBANK.png', '970446', NULL, 1, 1, TRUE),
  (53, 'CAKE', 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank', 'CAKE', 'https://cdn.vietqr.io/img/CAKE.png', '546034', NULL, 1, 1, TRUE),
  (54, 'Ubank', 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank', 'Ubank', 'https://cdn.vietqr.io/img/UBANK.png', '546035', NULL, 1, 1, TRUE),
  (55, 'KBank', 'Ngân hàng Đại chúng TNHH Kasikornbank', 'KBank', 'https://cdn.vietqr.io/img/KBANK.png', '668888', 'KASIVNVX', 1, 1, TRUE),
  (56, 'VNPTMONEY', 'VNPT Money', 'VNPTMoney', 'https://cdn.vietqr.io/img/VNPTMONEY.png', '971011', NULL, 0, 1, TRUE),
  (57, 'VTLMONEY', 'Tổng Công ty Dịch vụ số Viettel - Chi nhánh tập đoàn công nghiệp viễn thông Quân Đội', 'ViettelMoney', 'https://cdn.vietqr.io/img/VIETTELMONEY.png', '971005', NULL, 0, 1, TRUE),
  (58, 'TIMO', 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)', 'Timo', 'https://vietqr.net/portal-service/resources/icons/TIMO.png', '963388', NULL, 1, 0, TRUE),
  (59, 'CITIBANK', 'Ngân hàng Citibank, N.A. - Chi nhánh Hà Nội', 'Citibank', 'https://cdn.vietqr.io/img/CITIBANK.png', '533948', NULL, 0, 0, TRUE),
  (60, 'KEBHANAHCM', 'Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh', 'KEBHanaHCM', 'https://cdn.vietqr.io/img/KEBHANAHCM.png', '970466', NULL, 0, 0, TRUE),
  (61, 'KEBHANAHN', 'Ngân hàng KEB Hana – Chi nhánh Hà Nội', 'KEBHANAHN', 'https://cdn.vietqr.io/img/KEBHANAHN.png', '970467', NULL, 0, 0, TRUE),
  (62, 'MAFC', 'Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam)', 'MAFC', 'https://cdn.vietqr.io/img/MAFC.png', '977777', NULL, 0, 0, TRUE),
  (63, 'VBSP', 'Ngân hàng Chính sách Xã hội', 'VBSP', 'https://cdn.vietqr.io/img/VBSP.png', '999888', NULL, 0, 0, TRUE),
  (64, 'PVDB', 'Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số', 'PVcomBank Pay', 'https://cdn.vietqr.io/img/PVCB.png', '971133', 'WBVNVNVX', 1, 1, TRUE),
  (65, 'momo', 'CTCP Dịch Vụ Di Động Trực Tuyến', 'MoMo', 'https://cdn.vietqr.io/img/momo.png', '971025', NULL, 1, 1, TRUE)
ON DUPLICATE KEY UPDATE
  version = IF(
    NOT (
      vietqr_id <=> VALUES(vietqr_id)
      AND name <=> VALUES(name)
      AND short_name <=> VALUES(short_name)
      AND logo_url <=> VALUES(logo_url)
      AND bin <=> VALUES(bin)
      AND swift_code <=> VALUES(swift_code)
      AND transfer_supported <=> VALUES(transfer_supported)
      AND lookup_supported <=> VALUES(lookup_supported)
      AND active <=> VALUES(active)
    ),
    version + 1,
    version
  ),
  vietqr_id = VALUES(vietqr_id),
  name = VALUES(name),
  short_name = VALUES(short_name),
  logo_url = VALUES(logo_url),
  bin = VALUES(bin),
  swift_code = VALUES(swift_code),
  transfer_supported = VALUES(transfer_supported),
  lookup_supported = VALUES(lookup_supported),
  active = VALUES(active);

COMMIT;
