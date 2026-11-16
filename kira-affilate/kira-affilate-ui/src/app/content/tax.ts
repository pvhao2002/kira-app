import {KnowledgeEntry} from './knowledge';

// Each entry cites its source. `verified: true` only for Shopee's own help pages (read directly) and for
// recommendations; law entries stay false until checked against the primary gazette text.
export const TAX: KnowledgeEntry[] = [
  {
    "id": "t-overview",
    "category": "Tổng quan",
    "title": "Thu nhập tiếp thị liên kết bị đánh thuế thế nào",
    "kind": "legal",
    "body": [
      "Cách phân loại thu nhập đã thay đổi trong năm 2026 và hiện chưa thống nhất. Đến hết 2025, Shopee coi hoa hồng trả cho cá nhân không ký hợp đồng lao động là thu nhập từ tiền lương, tiền công và khấu trừ 10% thuế TNCN.",
      "Công văn 7403/CT-TMĐT ngày 06/10/2026 của Cục Thuế hướng dẫn: thu nhập tiếp thị liên kết do sàn hoặc nhãn hàng chi trả là thu nhập từ kinh doanh (trừ khi trả theo hợp đồng lao động), thuế TNCN 5% trên doanh thu theo nhóm nội dung số, quảng cáo số. Trong khi đó một số trả lời của cơ quan thuế địa phương vẫn coi cá nhân chưa đăng ký kinh doanh là có thu nhập tiền lương, tiền công.",
      "Vì vậy hãy hỏi cơ quan thuế quản lý trực tiếp về trường hợp của bạn trước khi kê khai."
    ],
    "sources": [
      {
        "title": "Hướng dẫn nghĩa vụ thuế với thu nhập tiếp thị liên kết, sáng tạo nội dung số",
        "number": "7403/CT-TMĐT",
        "issuer": "Cục Thuế",
        "effectiveDate": "2026-10-06",
        "url": "https://lsvn.vn/huong-dan-xac-dinh-nghia-vu-thue-doi-voi-thu-nhap-tu-hoat-dong-tiep-thi-lien-ket-sang-tao-noi-dung-so-a180742.html"
      },
      {
        "title": "Hỏi đáp chính sách tài chính",
        "issuer": "Bộ Tài chính",
        "url": "https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/167151"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-withholding",
    "category": "Khấu trừ tại nguồn",
    "title": "Khấu trừ 10% khi nhận hoa hồng",
    "kind": "legal",
    "body": [
      "Tổ chức trả thu nhập cho cá nhân cư trú không ký hợp đồng lao động (hoặc hợp đồng dưới 3 tháng) phải khấu trừ 10% thuế TNCN trước khi trả.",
      "Ngưỡng khấu trừ: từ 2.000.000 đồng mỗi lần chi trả (đến hết 30/6/2026); từ 5.000.000 đồng mỗi lần chi trả kể từ 01/7/2026.",
      "Cá nhân chỉ có duy nhất thu nhập thuộc diện khấu trừ này và ước tính tổng thu nhập sau giảm trừ gia cảnh chưa đến mức phải nộp thuế có thể làm bản cam kết (mẫu 08/CK-TNCN theo Thông tư 80/2021) để tạm thời chưa bị khấu trừ. Số hiệu mẫu theo nghị định mới chưa xác minh."
    ],
    "sources": [
      {
        "title": "Thông tư hướng dẫn Luật Thuế TNCN",
        "number": "111/2013/TT-BTC, Điều 25",
        "issuer": "Bộ Tài chính"
      },
      {
        "title": "Nghị định quy định chi tiết Luật Thuế TNCN",
        "number": "253/2026/NĐ-CP, Điều 50",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-07-01",
        "url": "https://lsvn.vn/chinh-thuc-nang-nguong-khau-tru-thue-thu-nhap-vang-lai-len-5-trieu-dong-lan-a175301.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-shopee-2026",
    "category": "Khấu trừ tại nguồn",
    "title": "Shopee khấu trừ từ 01/10/2026",
    "kind": "policy",
    "body": [
      "Theo phản ánh của người nộp thuế trên Cổng hỏi đáp Bộ Tài chính và báo chí, từ 01/10/2026 Shopee khấu trừ 5% thuế GTGT và 5% thuế TNCN trên hoa hồng tiếp thị liên kết, thay cho mức 10% trước đó. Chưa tìm thấy thông báo chính thức của Shopee.",
      "Điều khoản chương trình chỉ nêu Shopee có thể khấu trừ, kê khai và nộp thay thuế theo pháp luật hiện hành. Cá nhân có doanh thu năm dưới 1 tỷ đồng có thể cam kết không phải xuất hóa đơn. Việc hoàn hoặc bù trừ số đã khấu trừ khi doanh thu dưới ngưỡng chịu thuế chưa có hướng dẫn rõ."
    ],
    "sources": [
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      },
      {
        "title": "Hỏi đáp chính sách tài chính",
        "issuer": "Bộ Tài chính",
        "url": "https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/166943"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-pit",
    "category": "Thuế thu nhập cá nhân",
    "title": "Biểu thuế lũy tiến và giảm trừ gia cảnh",
    "kind": "legal",
    "body": [
      "Đến hết kỳ tính thuế 2025: biểu 7 bậc (5%, 10%, 15%, 20%, 25%, 30%, 35% với các mốc thu nhập tính thuế tháng 5, 10, 18, 32, 52, 80 triệu đồng); giảm trừ bản thân 11 triệu đồng/tháng, mỗi người phụ thuộc 4,4 triệu đồng/tháng.",
      "Từ kỳ tính thuế 2026: biểu 5 bậc (5%, 10%, 20%, 30%, 35% với các mốc 10, 30, 60, 100 triệu đồng/tháng); giảm trừ bản thân 15,5 triệu đồng/tháng, mỗi người phụ thuộc 6,2 triệu đồng/tháng."
    ],
    "sources": [
      {
        "title": "Luật Thuế thu nhập cá nhân",
        "number": "04/2007/QH12, Điều 22",
        "issuer": "Quốc hội",
        "effectiveDate": "2009-01-01"
      },
      {
        "title": "Luật Thuế thu nhập cá nhân",
        "number": "109/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-07-01",
        "url": "https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/luat-thue-thu-nhap-ca-nhan-109-2025-qh15"
      },
      {
        "title": "Nghị quyết điều chỉnh mức giảm trừ gia cảnh",
        "number": "954/2020/UBTVQH14",
        "issuer": "Ủy ban Thường vụ Quốc hội",
        "effectiveDate": "2020-07-01"
      },
      {
        "title": "Nghị quyết điều chỉnh mức giảm trừ gia cảnh",
        "number": "110/2025/UBTVQH15",
        "issuer": "Ủy ban Thường vụ Quốc hội",
        "effectiveDate": "2026-01-01",
        "url": "https://kpmg.com/vn/vi/home/phan-tich-chuyen-sau/2025/11/increase-pit-relief-from-tax-year-2026.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-business",
    "category": "Cá nhân kinh doanh",
    "title": "Thuế theo tỷ lệ trên doanh thu và ngưỡng chịu thuế",
    "kind": "legal",
    "body": [
      "Đến hết 2025 (Thông tư 40/2021): cá nhân kinh doanh có doanh thu năm từ 100 triệu đồng trở xuống không phải nộp thuế GTGT và TNCN; trên ngưỡng, hoạt động môi giới, hoa hồng đại lý chịu GTGT 5% và TNCN 2% trên doanh thu. Từ 01/7/2025 ngưỡng không chịu thuế GTGT là 200 triệu đồng/năm.",
      "Từ 2026: thuế khoán bị bãi bỏ. Nghị định 68/2026/NĐ-CP (được sửa bởi Nghị định 141/2026/NĐ-CP, áp dụng từ 01/01/2026) đặt ngưỡng doanh thu không phải nộp thuế là 1 tỷ đồng/năm; trên 1 tỷ đồng phải dùng hóa đơn điện tử. Thuế suất TNCN với nội dung số, quảng cáo số là 5%.",
      "Thuế suất GTGT trên doanh thu năm 2026 cho tiếp thị liên kết và cách tính trên phần doanh thu vượt ngưỡng chưa xác minh được."
    ],
    "sources": [
      {
        "title": "Thông tư về thuế GTGT, TNCN với hộ, cá nhân kinh doanh",
        "number": "40/2021/TT-BTC",
        "issuer": "Bộ Tài chính",
        "effectiveDate": "2021-08-01"
      },
      {
        "title": "Nghị định về chính sách thuế với hộ, cá nhân kinh doanh",
        "number": "68/2026/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-03-05",
        "url": "https://hatinh.gov.vn/vi/bai-viet/nhieu-diem-moi-dang-chu-y-trong-chinh-sach-thue-doi-voi-ho-va-ca-nhan-kinh-doanh"
      },
      {
        "title": "Nghị định sửa đổi Nghị định 68/2026",
        "number": "141/2026/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-01-01",
        "url": "https://lsvn.vn/chinh-thuc-nang-nguong-chiu-thue-voi-ho-kinh-doanh-len-1-ti-dong-nam-a172198.html"
      },
      {
        "title": "Luật Thuế giá trị gia tăng",
        "number": "48/2024/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2025-07-01"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-register",
    "category": "Đăng ký và kê khai",
    "title": "Mã số thuế và đăng ký thuế",
    "kind": "legal",
    "body": [
      "Từ 01/7/2025, số định danh cá nhân (12 số trên căn cước) được dùng thay cho mã số thuế của cá nhân, hộ gia đình, hộ kinh doanh. Người đã có nhiều mã số thuế được hợp nhất về số định danh.",
      "Lệ phí môn bài được bãi bỏ từ 01/01/2026; khoản còn nợ của năm 2025 trở về trước vẫn phải nộp."
    ],
    "sources": [
      {
        "title": "Thông tư về đăng ký thuế",
        "number": "86/2024/TT-BTC",
        "issuer": "Bộ Tài chính",
        "effectiveDate": "2025-02-06",
        "url": "https://thoibaotaichinhvietnam.vn/tu-172025-su-dung-so-dinh-danh-ca-nhan-thay-cho-ma-so-thue-167495.html"
      },
      {
        "title": "Nghị quyết về cơ chế, chính sách phát triển kinh tế tư nhân",
        "number": "198/2025/QH15, Điều 10",
        "issuer": "Quốc hội",
        "effectiveDate": "2025-05-17",
        "url": "https://luatvietnam.vn/thue-phi-le-phi/doanh-nghiep-ho-kinh-doanh-khong-con-phai-nop-khoan-tien-nay-tu-01-01-2026-565-106005-article.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "t-finalize",
    "category": "Đăng ký và kê khai",
    "title": "Các bước quyết toán thuế TNCN",
    "kind": "legal",
    "body": [
      "Cá nhân có thu nhập tiền lương, tiền công tự quyết toán nếu có số thuế phải nộp thêm hoặc muốn hoàn thuế nộp thừa. Với thu nhập năm 2025: tờ khai mẫu 02/QTT-TNCN (kèm bảng kê người phụ thuộc 02-1/BK-QTT-TNCN), hạn nộp 30/4/2026 (lùi sang ngày làm việc kế tiếp nếu trùng ngày nghỉ).",
      "Mẫu biểu và thời hạn quyết toán cho thu nhập năm 2026 theo Luật Quản lý thuế số 108/2025/QH15 chưa xác minh được; kiểm tra thông báo của cơ quan thuế đầu năm 2027."
    ],
    "sources": [
      {
        "title": "Thông tư hướng dẫn Luật Quản lý thuế",
        "number": "80/2021/TT-BTC",
        "issuer": "Bộ Tài chính",
        "effectiveDate": "2022-01-01"
      },
      {
        "title": "Luật Quản lý thuế",
        "number": "108/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-07-01",
        "url": "https://thuvienphapluat.vn/hoi-dap-phap-luat/luat-quan-ly-thue-2025-co-hieu-luc-tu-01012026-hay-172026-138074277.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Bước 1: Thu thập chứng từ khấu trừ thuế từ Shopee và các nơi trả thu nhập khác.",
      "Bước 2: Đăng nhập thuedientu.gdt.gov.vn hoặc ứng dụng eTax Mobile bằng tài khoản định danh.",
      "Bước 3: Chọn quyết toán thuế TNCN, điền tổng thu nhập, số thuế đã khấu trừ, người phụ thuộc.",
      "Bước 4: Đính kèm chứng từ khấu trừ, nộp tờ khai và lưu lại thông báo tiếp nhận.",
      "Bước 5: Nộp thêm thuế nếu thiếu, hoặc theo dõi hồ sơ hoàn thuế nếu nộp thừa."
    ]
  },
  {
    "id": "t-penalty",
    "category": "Đăng ký và kê khai",
    "title": "Chậm nộp hồ sơ khai thuế",
    "kind": "legal",
    "body": [
      "Xử phạt vi phạm hành chính về thuế, hóa đơn thực hiện theo Nghị định 125/2020/NĐ-CP (đã được sửa đổi nhiều lần, gần nhất bởi Nghị định 291/2026/NĐ-CP có hiệu lực 21/7/2026). Chậm nộp hồ sơ khai thuế bị xử lý theo Điều 13; ngoài ra còn bị tính tiền chậm nộp trên số thuế nộp chậm.",
      "Mức phạt cụ thể không được nêu ở đây vì chưa đối chiếu được văn bản hợp nhất hiện hành."
    ],
    "sources": [
      {
        "title": "Nghị định xử phạt vi phạm hành chính về thuế, hóa đơn",
        "number": "125/2020/NĐ-CP, Điều 13",
        "issuer": "Chính phủ",
        "effectiveDate": "2020-12-05"
      },
      {
        "title": "Nghị định sửa đổi Nghị định 125/2020",
        "number": "291/2026/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-07-21",
        "url": "https://amis.misa.vn/284709/nghi-dinh-291-2026-nd-cp/"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  }
];
