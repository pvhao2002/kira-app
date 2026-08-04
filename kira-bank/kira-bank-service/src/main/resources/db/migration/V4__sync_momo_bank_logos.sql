-- MoMo bank-code snapshot fetched 2026-08-04 from https://payment.momo.vn/v2/gateway/api/bankcodes
-- Match existing banks by BIN to preserve IDs and card foreign keys.
-- Insert missing banks; duplicate records update only logo_url.
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO banks (
  code,
  name,
  short_name,
  logo_url,
  bin,
  transfer_supported,
  lookup_supported,
  active
)
SELECT
  COALESCE(existing.code, source.code),
  COALESCE(existing.name, source.name),
  COALESCE(existing.short_name, source.short_name),
  source.logo_url,
  COALESCE(existing.bin, source.bin),
  COALESCE(existing.transfer_supported, source.transfer_supported),
  COALESCE(existing.lookup_supported, FALSE),
  COALESCE(existing.active, TRUE)
FROM (
  SELECT 'ABB' AS code, 'Ngân hàng TMCP An Bình' AS name, 'ABBANK' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/ABB.png' AS logo_url, '970425' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'ACB' AS code, 'Ngân hàng TMCP Á Châu' AS name, 'ACB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/ACB.png' AS logo_url, '970416' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BIDC' AS code, 'Đầu tư và Phát triển Campuchia - Chi nhánh Hà Nội' AS name, 'BIDC' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_bidc.png' AS logo_url, '555666' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BIDV' AS code, 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' AS name, 'BIDV' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/BIDV.png' AS logo_url, '970418' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BNPPARIBASHCM' AS code, 'Ngân hàng BNP Paribas - CN TP.HCM' AS name, 'BNP PARIBAS HCM' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_bnp.png' AS logo_url, '963666' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BNPPARIBASHN' AS code, 'Ngân hàng BNP Paribas - CN Hà Nội' AS name, 'BNP PARIBAS HN' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_bnp.png' AS logo_url, '963668' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BOCHK' AS code, 'Ngân hàng Bank of China (Hongkong) Limited – Chi nhánh Hồ Chí Minh' AS name, 'Bank of China (HK) - HCM' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_bochk.png' AS logo_url, '963688' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'BVB' AS code, 'Ngân hàng TMCP Bảo Việt' AS name, 'BaoVietBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/BVB.png' AS logo_url, '970438' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CAKE' AS code, 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank' AS name, 'CAKE' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_cake.png' AS logo_url, '546034' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CBB' AS code, 'Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam' AS name, 'CBBank' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_cbbank.png' AS logo_url, '970444' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CFC' AS code, 'Công ty Tài chính Cổ Phần Tín Việt' AS name, 'VietCredit' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/CFC.png' AS logo_url, '970460' AS bin, 0 AS transfer_supported
  UNION ALL
  SELECT 'CIMB' AS code, 'Ngân hàng TNHH MTV CIMB Việt Nam' AS name, 'CIMB' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_cimb.png' AS logo_url, '422589' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CITI' AS code, 'NH Citi' AS name, 'CITI' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_citibank.png' AS logo_url, '533948' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'COB' AS code, 'Ngân hàng Hợp tác xã Việt Nam' AS name, 'COOPBANK' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_coop_bank.png' AS logo_url, '970446' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CTG' AS code, 'Ngân hàng TMCP Công thương Việt Nam' AS name, 'VietinBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/CTG.png' AS logo_url, '970415' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'CUBHCM' AS code, 'Ngân hàng Cathay United - CN TP.HCM' AS name, 'Cathay -HCM' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_cub.png' AS logo_url, '168999' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'DBS' AS code, 'DBS Bank Ltd - Chi nhánh Thành phố Hồ Chí Minh' AS name, 'DBSBank' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_dbs.png' AS logo_url, '796500' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'EIB' AS code, 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' AS name, 'Eximbank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/EIB.png' AS logo_url, '970431' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'GPB' AS code, 'Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu' AS name, 'GPBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/GPB.png' AS logo_url, '970408' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'HDB' AS code, 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh' AS name, 'HDBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/HDB.png' AS logo_url, '970437, 970420' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'HLB' AS code, 'Ngân hàng TNHH MTV Hong Leong Việt Nam' AS name, 'HongLeong' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_hong_leon_bank.png' AS logo_url, '970442' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'HSBC' AS code, 'Ngân hàng TNHH MTV HSBC (Việt Nam)' AS name, 'HSBC' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_hsbc.png' AS logo_url, '458761' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'IBKHCM' AS code, 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh' AS name, 'IBKHCM' AS short_name, 'https://img.mservice.com.vn/app/img/payment/IBK.png' AS logo_url, '970456' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'IBKHN' AS code, 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội' AS name, 'IBKHN' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_ibk_bank.png' AS logo_url, '970455' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'IVB' AS code, 'Ngân hàng TNHH Indovina' AS name, 'IndovinaBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/IVB.png' AS logo_url, '970434' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KBankHCM' AS code, 'Ngân hàng Đại chúng TNHH Kasikornbank' AS name, 'KBank' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_kbank.png' AS logo_url, '668888' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KBHCM' AS code, 'Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh' AS name, 'KookminHCM' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_kookmin_hcm.png' AS logo_url, '970463' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KBHN' AS code, 'Ngân hàng Kookmin - Chi nhánh Hà Nội' AS name, 'KookminHN' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_kookmin_hn.png' AS logo_url, '970462' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KEBHANAHCM' AS code, 'Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh' AS name, 'Keb Hana - HCM' AS short_name, 'https://img.mservice.com.vn/app/img/payment/KEBHANAHCM.png' AS logo_url, '970466' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KEBHANAHN' AS code, 'Ngân hàng KEB Hana – Chi nhánh Hà Nội' AS name, 'Keb Hana- HN' AS short_name, 'https://img.mservice.com.vn/app/img/payment/KEBHANAHCM.png' AS logo_url, '970467' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'KLB' AS code, 'Ngân hàng TMCP Kiên Long' AS name, 'KienLongBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/KLB.png' AS logo_url, '970452' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'Liobank' AS code, 'Liobank by OCB' AS name, 'Liobank' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_lio.png' AS logo_url, '963369' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'LPB' AS code, 'NH TMCP Loc Phat Viet Nam' AS name, 'LPBank' AS short_name, 'https://static.momocdn.net/files/cGF5bWVudHNkaw==/image/LPB.png' AS logo_url, '970449' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'MAFC' AS code, 'Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam)' AS name, 'MTV Mirae Asset' AS short_name, 'https://img.mservice.com.vn/app/img/payment/MAFC.png' AS logo_url, '970468' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'MB' AS code, 'Ngân hàng TMCP Quân đội' AS name, 'MBBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/MB.png' AS logo_url, '970422' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'MBV' AS code, 'Ngân hàng TNHH MTV Việt Nam Hiện Đại' AS name, 'MBV' AS short_name, 'https://static.momocdn.net/files/cGF5bWVudHNkaw==/image/MBV.png' AS logo_url, '970414' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'MCREDIT' AS code, 'Công ty Tài chính TNHH MB SHINSEI' AS name, 'MB SHINSEI' AS short_name, 'https://static.momocdn.net/app/img/payment_sdk/mcredit.png' AS logo_url, '970470' AS bin, 0 AS transfer_supported
  UNION ALL
  SELECT 'MoMo' AS code, 'Công ty Dịch vụ đi động trực tuyến M_Service' AS name, 'MoMo' AS short_name, 'https://static.momocdn.net/app/img/payment/logovuong.png' AS logo_url, '971025' AS bin, 0 AS transfer_supported
  UNION ALL
  SELECT 'MSB' AS code, 'Ngân hàng TMCP Hàng Hải' AS name, 'MSB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/MSB.png' AS logo_url, '970426' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'MVAS' AS code, 'Trung tâm Dịch vụ số Mobifone - CN Tổng Công ty viễn thông Mobifone' AS name, 'MVAS' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_mvas.png' AS logo_url, '971032' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'NAB' AS code, 'Ngân hàng TMCP Nam Á' AS name, 'NamABank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/NAB.png' AS logo_url, '970428' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'NASB' AS code, 'Ngân hàng TMCP Bắc Á' AS name, 'BacABank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/NASB.png' AS logo_url, '970409' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'NonghyupBankHN' AS code, 'Ngân hàng Nonghyup - Chi nhánh Hà Nội' AS name, 'Nonghyup' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_nonghyu.png' AS logo_url, '801011' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'NVB' AS code, 'Ngân hàng TMCP Quốc Dân' AS name, 'NCB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/NVB.png' AS logo_url, '970419' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'OCB' AS code, 'Ngân hàng TMCP Phương Đông' AS name, 'OCB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/OCB.png' AS logo_url, '970448' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'PBVN' AS code, 'Ngân hàng TNHH MTV Public Việt Nam' AS name, 'PublicBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/PBVN.png' AS logo_url, '970439' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'PGB' AS code, 'Ngân hàng TMCP Xăng dầu Petrolimex' AS name, 'PGBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/PGB.png' AS logo_url, '970430' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'PVCB' AS code, 'Ngân hàng TMCP Đại Chúng Việt Nam' AS name, 'PVcomBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/PVCB.png' AS logo_url, '970412' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'PVcomBankPay' AS code, 'PVcomBank Pay' AS name, 'PVcomBank Pay' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/PVCB.png' AS logo_url, '971133' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SCB' AS code, 'Ngân hàng TMCP Sài Gòn' AS name, 'SCB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/SCB.png' AS logo_url, '970429' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SEAB' AS code, 'Ngân hàng TMCP Đông Nam Á' AS name, 'SeABank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/Seab.png' AS logo_url, '970440' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SGB' AS code, 'Ngân hàng TMCP Sài Gòn Công Thương' AS name, 'SaigonBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/SGB.png' AS logo_url, '970400' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SHB' AS code, 'Ngân hàng TMCP Sài Gòn - Hà Nội' AS name, 'SHB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/SHB.png' AS logo_url, '970443' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'STANDARD' AS code, 'Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam' AS name, 'StandardChartered' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_standard_chartered.png' AS logo_url, '970410' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'STB' AS code, 'Ngân hàng TMCP Sài Gòn Thương Tín' AS name, 'Sacombank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/STB.png' AS logo_url, '970403' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SVB' AS code, 'Ngân hàng TNHH MTV Shinhan Việt Nam' AS name, 'ShinhanBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/SVB.png' AS logo_url, '970424' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'SVFC' AS code, 'Công ty Tài chính TNHH MTV Shinhan Việt Nam' AS name, 'Tài chính Shinhan' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_shinhan_finance.png' AS logo_url, '963368' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'TCB' AS code, 'Ngân hàng TMCP Kỹ thương Việt Nam' AS name, 'Techcombank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/TCB.png' AS logo_url, '970407' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'TIMO' AS code, 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)' AS name, 'Timo' AS short_name, 'https://img.mservice.com.vn/app/img/payment/TIMO.png' AS logo_url, '963388' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'TPB' AS code, 'Ngân hàng TMCP Tiên Phong' AS name, 'TPBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/TPB.png' AS logo_url, '970423' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'Ubank' AS code, 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank' AS name, 'Ubank' AS short_name, 'https://img.mservice.io/momo_app_v2/new_version/All_team_/new_logo_bank/ic_ubank.png' AS logo_url, '546035' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'Umee' AS code, 'UMEE by Kienlongbank' AS name, 'Umee' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_umee.png' AS logo_url, '963399' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'UOB' AS code, 'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh' AS name, 'UnitedOverseas' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/UOB.png' AS logo_url, '970458' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VAB' AS code, 'Ngân hàng TMCP Việt Á' AS name, 'VietABank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VAB.png' AS logo_url, '970427' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VARB' AS code, 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' AS name, 'Agribank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VARB.png' AS logo_url, '970405' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VB' AS code, 'Ngân hàng TMCP Việt Nam Thương Tín' AS name, 'VietBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VB.png' AS logo_url, '970433' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VBSP' AS code, 'Ngân Hàng Chính Sách Xã Hội' AS name, 'VBSP' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_vbsp.png' AS logo_url, '999888' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VCB' AS code, 'Ngân hàng TMCP Ngoại Thương Việt Nam' AS name, 'VietcomBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VCB.png' AS logo_url, '970436' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VCCB' AS code, 'Ngân hàng TMCP Bản Việt' AS name, 'VietCapitalBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VCCB.png' AS logo_url, '970454' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VIB' AS code, 'Ngân hàng TMCP Quốc tế Việt Nam' AS name, 'VIB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VIB.png' AS logo_url, '970441' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'Vikki' AS code, 'Ngân hàng TNHH MTV Số Vikki' AS name, 'Vikki Digital Bank' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_vikki.png' AS logo_url, '970406' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VikkiHDBANK' AS code, 'Vikki by HDBank' AS name, 'Vikki by HDBank' AS short_name, 'https://static.momocdn.net/app/img/momo_app_v2/new_version/All_team/bank/ic_vikki.png' AS logo_url, '963311' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VNPTMONEY' AS code, 'VNPT Money' AS name, 'VNPTMoney' AS short_name, 'https://img.mservice.com.vn/app/img/payment/VNPTMONEY.png' AS logo_url, '971011' AS bin, 0 AS transfer_supported
  UNION ALL
  SELECT 'VPB' AS code, 'Ngân hàng TMCP Việt Nam Thịnh Vượng' AS name, 'VPBank' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VPB.png' AS logo_url, '970432' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VRB' AS code, 'Ngân hàng Liên doanh Việt - Nga' AS name, 'VRB' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/VRB.png' AS logo_url, '970421' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'VTLMONEY' AS code, 'Viettel Money' AS name, 'ViettelMoney' AS short_name, 'https://img.mservice.com.vn/app/img/payment/VIETTELMONEY.png' AS logo_url, '971005' AS bin, 1 AS transfer_supported
  UNION ALL
  SELECT 'WOO' AS code, 'Ngân hàng TNHH MTV Woori Việt Nam' AS name, 'Woori' AS short_name, 'https://img.mservice.com.vn/momo_app_v2/img/WOO.png' AS logo_url, '970457' AS bin, 1 AS transfer_supported
) source
LEFT JOIN banks existing ON existing.bin = source.bin
ON DUPLICATE KEY UPDATE
  version = IF(NOT (banks.logo_url <=> VALUES(logo_url)), banks.version + 1, banks.version),
  logo_url = VALUES(logo_url);

COMMIT;
