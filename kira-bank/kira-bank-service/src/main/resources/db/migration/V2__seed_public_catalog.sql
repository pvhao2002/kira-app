INSERT INTO roles(name) VALUES ('ROLE_USER'),('ROLE_ADMIN');
INSERT INTO banks(code,name,short_name,website,brand_color,description) VALUES
 ('VCB','Ngân hàng TMCP Ngoại thương Việt Nam','Vietcombank','https://vietcombank.com.vn','#006B54','Ngân hàng thương mại Việt Nam'),
 ('TCB','Ngân hàng TMCP Kỹ thương Việt Nam','Techcombank','https://techcombank.com','#E31837','Ngân hàng thương mại Việt Nam'),
 ('VPB','Ngân hàng TMCP Việt Nam Thịnh Vượng','VPBank','https://vpbank.com.vn','#007F3E','Ngân hàng thương mại Việt Nam');
INSERT INTO credit_card_catalogs(bank_id,card_name,card_code,card_network,card_tier,annual_fee,cashback_limit,default_statement_day,default_due_day,cashback_condition,description) VALUES
 ((SELECT id FROM banks WHERE code='VCB'),'Vietcombank CashPlus Platinum','VCB-CASHPLUS','VISA','PLATINUM',800000,1000000,20,15,'Áp dụng theo danh mục MCC và điều kiện từng kỳ','Thẻ hoàn tiền cho chi tiêu hằng ngày'),
 ((SELECT id FROM banks WHERE code='TCB'),'Techcombank Everyday','TCB-EVERYDAY','VISA','GOLD',500000,800000,25,15,'Giao dịch hợp lệ đã ghi sổ','Thẻ hoàn tiền đa danh mục');
INSERT INTO mccs(code,name,category,merchant_type,description) VALUES
 ('5411','Cửa hàng tạp hóa và siêu thị','Mua sắm thiết yếu','Retail','Grocery stores and supermarkets'),
 ('5812','Nhà hàng','Ẩm thực','Food & Beverage','Eating places and restaurants'),
 ('5541','Trạm xăng','Di chuyển','Fuel','Service stations'),
 ('4814','Dịch vụ viễn thông','Tiện ích','Telecommunication','Telecommunication services');
INSERT INTO cashback_rules(card_catalog_id,mcc_id,cashback_rate,cashback_cap,minimum_spending,eligible_amount_limit,limit_cycle,effective_from,conditions_text) VALUES
 ((SELECT id FROM credit_card_catalogs WHERE card_code='VCB-CASHPLUS'),(SELECT id FROM mccs WHERE code='5411'),0.05,1000000,0,20000000,'MONTHLY','2026-01-01','Giao dịch đã ghi sổ, không bị hoàn/hủy'),
 ((SELECT id FROM credit_card_catalogs WHERE card_code='TCB-EVERYDAY'),(SELECT id FROM mccs WHERE code='5812'),0.03,800000,0,26666666,'MONTHLY','2026-01-01','Giao dịch hợp lệ tại nhà hàng');
INSERT INTO investment_platforms(name,code,website_url,description) VALUES ('Nền tảng Demo','DEMO','https://example.invalid','Dữ liệu mẫu phục vụ development; Kira Bank không thực hiện giao dịch trên nền tảng này');
INSERT INTO service_providers(name) VALUES ('Đơn vị dịch vụ mẫu');
INSERT INTO application_settings(setting_key,setting_value,description) VALUES ('finance.rounding_mode','HALF_UP','Rounding mode dùng cho phép tính tiền'),('finance.tolerance','0.01','Sai số đối soát tối đa');
