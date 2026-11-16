import {KnowledgeEntry} from './knowledge';

// Each entry cites its source. `verified: true` only for Shopee's own help pages (read directly) and for
// recommendations; law entries stay false until checked against the primary gazette text.
export const LEGAL: KnowledgeEntry[] = [
  {
    "id": "l-ads-duty",
    "category": "Quảng cáo",
    "title": "Nghĩa vụ của người chuyển tải sản phẩm quảng cáo (KOL, KOC, người có ảnh hưởng)",
    "kind": "legal",
    "body": [
      "Luật Quảng cáo sửa đổi 2025 bổ sung Điều 15a về người chuyển tải sản phẩm quảng cáo. Người đăng nội dung kèm liên kết tiếp thị để hưởng hoa hồng thuộc nhóm này."
    ],
    "sources": [
      {
        "title": "Luật sửa đổi, bổ sung một số điều của Luật Quảng cáo",
        "number": "75/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-01-01",
        "url": "https://luatvietnam.vn/linh-vuc-khac/diem-moi-cua-luat-quang-cao-sua-doi-2025-883-102813-article.html"
      },
      {
        "title": "Luật Quảng cáo",
        "number": "16/2012/QH13",
        "issuer": "Quốc hội",
        "effectiveDate": "2013-01-01"
      },
      {
        "title": "Nghị định quy định chi tiết Luật Quảng cáo",
        "number": "342/2025/NĐ-CP",
        "issuer": "Chính phủ"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Kiểm tra tư cách của người quảng cáo và tài liệu về sản phẩm.",
      "Không giới thiệu sản phẩm mình chưa sử dụng hoặc chưa hiểu rõ.",
      "Thông báo rõ nội dung là quảng cáo, trước và trong khi thực hiện.",
      "Nộp thuế với thu nhập từ quảng cáo.",
      "Chịu trách nhiệm nếu nội dung quảng cáo sai sự thật.",
      "Gỡ nội dung vi phạm trong 24 giờ khi cơ quan có thẩm quyền yêu cầu."
    ]
  },
  {
    "id": "l-ads-penalty",
    "category": "Quảng cáo",
    "title": "Mức phạt với người có ảnh hưởng quảng cáo sai quy định",
    "kind": "legal",
    "body": [
      "Theo Nghị định 87/2026/NĐ-CP (hiệu lực 15/5/2026), Điều 51: phạt 40–60 triệu đồng nếu không xác minh người quảng cáo hoặc tài liệu sản phẩm; 60–80 triệu đồng nếu không thông báo đang quảng cáo; 80–100 triệu đồng nếu giới thiệu sản phẩm chưa sử dụng. Biện pháp khắc phục gồm gỡ quảng cáo, nộp lại số lợi bất hợp pháp và cải chính công khai.",
      "Chưa xác minh nghị định này đã thay thế hoàn toàn Nghị định 38/2021/NĐ-CP về quảng cáo hay chưa."
    ],
    "sources": [
      {
        "title": "Nghị định xử phạt vi phạm hành chính trong lĩnh vực văn hóa, quảng cáo",
        "number": "87/2026/NĐ-CP, Điều 51",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-05-15",
        "url": "https://lsvn.vn/nguoi-noi-tieng-co-the-bi-phat-toi-100-trieu-dong-neu-quang-cao-san-pham-ma-chua-su-dung-a172276.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "l-ecom",
    "category": "Thương mại điện tử",
    "title": "Luật Thương mại điện tử 2025 và tiếp thị liên kết",
    "kind": "legal",
    "body": [
      "Luật Thương mại điện tử số 122/2025/QH15 có hiệu lực từ 01/7/2026, lần đầu định nghĩa tiếp thị liên kết (Điều 3) và quy định trách nhiệm của người tiếp thị liên kết. Nghị định 248/2026/NĐ-CP hướng dẫn thi hành, thay thế Nghị định 52/2013 và 85/2021. Số điều khoản cụ thể chưa đối chiếu văn bản gốc."
    ],
    "sources": [
      {
        "title": "Luật Thương mại điện tử",
        "number": "122/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-07-01",
        "url": "https://kpmg.com/us/en/taxnewsflash/news/2026/06/tnf-vietnam-law-on-e-commerce-2025-effective-july-1-2026.html"
      },
      {
        "title": "Nghị định hướng dẫn Luật Thương mại điện tử",
        "number": "248/2026/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-07-01",
        "url": "https://hethongphapluat.com/nghi-dinh-248-2026-nd-cp-huong-dan-luat-thuong-mai-dien-tu.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Xác thực danh tính trước khi hoạt động tiếp thị liên kết.",
      "Không quảng bá cho nền tảng bất hợp pháp hoặc mô hình đa cấp không phép.",
      "Gỡ liên kết dẫn tới hàng hóa, dịch vụ bị cấm.",
      "Người bán hàng qua livestream phải xác thực danh tính."
    ]
  },
  {
    "id": "l-consumer",
    "category": "Bảo vệ người tiêu dùng",
    "title": "Trách nhiệm với người tiêu dùng",
    "kind": "legal",
    "body": [
      "Luật Bảo vệ quyền lợi người tiêu dùng 2023 (hiệu lực 01/7/2024) và Nghị định 55/2024/NĐ-CP định nghĩa \"người có ảnh hưởng\" và yêu cầu công khai việc được tài trợ khi giới thiệu sản phẩm, cung cấp thông tin trung thực, không gây nhầm lẫn cho người tiêu dùng. Số điều khoản cụ thể chưa đối chiếu."
    ],
    "sources": [
      {
        "title": "Luật Bảo vệ quyền lợi người tiêu dùng",
        "number": "19/2023/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2024-07-01"
      },
      {
        "title": "Nghị định quy định chi tiết Luật Bảo vệ quyền lợi người tiêu dùng",
        "number": "55/2024/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2024-07-01",
        "url": "https://moit.gov.vn/tin-tuc/bao-chi-voi-nguoi-dan/nhung-diem-moi-cua-nghi-dinh-so-55-2024-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-cua-luat-bao-ve-quyen-loi-nguoi-tieu-dung-20.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "l-data",
    "category": "Dữ liệu cá nhân",
    "title": "Thu thập và sử dụng dữ liệu cá nhân",
    "kind": "legal",
    "body": [
      "Luật Bảo vệ dữ liệu cá nhân 2025 có hiệu lực từ 01/01/2026, cùng Nghị định 356/2025/NĐ-CP thay thế Nghị định 13/2023. Nếu bạn thu thập email, số điện thoại hay dữ liệu người theo dõi (ví dụ qua form, nhóm chat, minigame), bạn cần có sự đồng ý rõ ràng, nêu mục đích và không chuyển cho bên khác ngoài mục đích đó.",
      "Có nguồn ghi số hiệu luật là 91/2025/QH15, có nguồn ghi 90/2025; cần kiểm tra lại."
    ],
    "sources": [
      {
        "title": "Luật Bảo vệ dữ liệu cá nhân",
        "number": "91/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-01-01",
        "url": "https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html"
      },
      {
        "title": "Nghị định quy định chi tiết Luật Bảo vệ dữ liệu cá nhân",
        "number": "356/2025/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2026-01-01",
        "url": "https://luatvietan.vn/diem-moi-cua-nghi-dinh-356-2025-so-voi-nghi-dinh-13-2023-ve-huong-dan-bao-ve-du-lieu-ca-nhan.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "l-ip",
    "category": "Sở hữu trí tuệ",
    "title": "Dùng hình ảnh sản phẩm và tên thương hiệu",
    "kind": "legal",
    "body": [
      "Luật Sở hữu trí tuệ 2005 (sửa đổi 2009, 2019, 2022 và bởi Luật 131/2025/QH15 có hiệu lực 01/4/2026) bảo hộ quyền tác giả với hình ảnh, video và quyền với nhãn hiệu. Không có quy định riêng cho tiếp thị liên kết; áp dụng nguyên tắc chung."
    ],
    "sources": [
      {
        "title": "Luật Sở hữu trí tuệ",
        "number": "50/2005/QH11",
        "issuer": "Quốc hội",
        "effectiveDate": "2006-07-01"
      },
      {
        "title": "Luật sửa đổi, bổ sung Luật Sở hữu trí tuệ",
        "number": "131/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-04-01",
        "url": "https://pbgdpl.gov.vn/noidung/tintuc/Lists/TLDCGioiThieu/Attachments/440/Tai%20lieu%20gioi%20thieu%20Luat%20sdbs%20msd%20Luat%20SHTT%202025.pdf"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Chỉ dùng hình ảnh, video do bạn tự tạo hoặc được người bán, nhãn hàng cho phép.",
      "Không dùng nhãn hiệu theo cách khiến người xem tưởng bạn là đại diện chính thức.",
      "Không sao chép nội dung của nhà sáng tạo khác."
    ]
  },
  {
    "id": "l-cyber",
    "category": "An ninh mạng và mạng xã hội",
    "title": "Tài khoản mạng xã hội và xác thực",
    "kind": "legal",
    "body": [
      "Luật An ninh mạng số 116/2025/QH15 (hiệu lực 01/7/2026) cấm mở tài khoản bằng thông tin giả mạo hoặc mượn danh tính. Nghị định 147/2024/NĐ-CP yêu cầu tài khoản mạng xã hội được xác thực (bằng số điện thoại hoặc số định danh) mới được đăng, bình luận, livestream; hiệu lực hiện tại của nghị định này chưa xác minh."
    ],
    "sources": [
      {
        "title": "Luật An ninh mạng",
        "number": "116/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2026-07-01",
        "url": "https://hatinh.gov.vn/vi/bai-viet/luat-an-ninh-mang-co-hieu-luc-tu-172026-dat-con-nguoi-o-vi-tri-trung-tam"
      },
      {
        "title": "Nghị định quản lý, cung cấp, sử dụng dịch vụ Internet và thông tin trên mạng",
        "number": "147/2024/NĐ-CP",
        "issuer": "Chính phủ",
        "effectiveDate": "2024-12-25"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "l-criminal",
    "category": "Trách nhiệm hình sự",
    "title": "Quảng cáo gian dối",
    "kind": "legal",
    "body": [
      "Bộ luật Hình sự 2015 có tội quảng cáo gian dối (Điều 197). Luật số 86/2025/QH15 (hiệu lực 01/7/2025) tăng mức phạt với nhiều tội phạm kinh tế và an toàn thực phẩm. Người có ảnh hưởng quảng cáo sai sự thật về thực phẩm, mỹ phẩm, sản phẩm sức khỏe có thể bị xử lý hình sự. Việc Điều 197 có được sửa đổi hay không chưa xác minh."
    ],
    "sources": [
      {
        "title": "Bộ luật Hình sự",
        "number": "100/2015/QH13",
        "issuer": "Quốc hội",
        "effectiveDate": "2018-01-01"
      },
      {
        "title": "Luật sửa đổi, bổ sung Bộ luật Hình sự",
        "number": "86/2025/QH15",
        "issuer": "Quốc hội",
        "effectiveDate": "2025-07-01",
        "url": "https://luatvietnam.vn/tin-van-ban-moi/nguoi-co-anh-huong-quang-cao-sai-su-that-co-the-bi-xu-ly-hinh-su-186-103749-article.html"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "l-shopee",
    "category": "Chính sách Shopee Affiliate",
    "title": "Điều khoản chương trình Shopee Affiliate",
    "kind": "policy",
    "body": [
      "Đây là thỏa thuận giữa bạn và Shopee, không phải pháp luật. Vi phạm dẫn tới hủy hoa hồng hoặc chấm dứt tư cách đối tác, độc lập với trách nhiệm pháp lý."
    ],
    "sources": [
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      },
      {
        "title": "Cách ghi nhận hoa hồng",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/122941"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Cookie ghi nhận 7 ngày; đơn thành công phải hoàn tất trong 30 ngày kể từ lượt giới thiệu.",
      "Cấm quảng cáo tìm kiếm dùng thương hiệu Shopee, lưu lượng tự động, tài khoản hàng loạt, thu thập dữ liệu trên sàn.",
      "Shopee có quyền khấu trừ và nộp thay thuế; đối tác phải khai đúng tư cách kinh doanh."
    ]
  },
  {
    "id": "l-practice",
    "category": "Khuyến nghị thực hành",
    "title": "Danh sách kiểm tra trước khi đăng nội dung",
    "kind": "recommendation",
    "body": [
      "Tổng hợp thực hành an toàn; không thay thế tư vấn pháp lý."
    ],
    "sources": [],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Ghi rõ \"Quảng cáo\" hoặc \"Liên kết tiếp thị – tôi nhận hoa hồng\" ở đầu nội dung.",
      "Chỉ giới thiệu sản phẩm đã dùng thử; lưu bằng chứng (ảnh, hóa đơn).",
      "Với thực phẩm chức năng, mỹ phẩm, thiết bị y tế: kiểm tra giấy phép quảng cáo của sản phẩm, không nói sản phẩm chữa bệnh.",
      "Không dùng ảnh, video của người khác khi chưa được phép.",
      "Lưu chứng từ khấu trừ thuế và sao kê hoa hồng theo năm."
    ]
  }
];
