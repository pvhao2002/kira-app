import {KnowledgeEntry} from './knowledge';

// Each entry cites its source. `verified: true` only for Shopee's own help pages (read directly) and for
// recommendations; law entries stay false until checked against the primary gazette text.
export const GUIDES: KnowledgeEntry[] = [
  {
    "id": "g-join",
    "category": "Đăng ký tham gia",
    "title": "Đăng ký và điều kiện tham gia",
    "kind": "policy",
    "body": [
      "Đăng ký tại affiliate.shopee.vn bằng tài khoản Shopee. Mỗi đối tác chỉ tham gia dưới một hình thức (cá nhân hoặc tổ chức) và phải khai đúng tư cách kinh doanh của mình.",
      "Điều kiện xét duyệt chi tiết (kênh, lượng theo dõi…) do Shopee quyết định và hiển thị trong quá trình đăng ký; ứng dụng này không liệt kê vì chưa xác minh được từ nguồn chính thức."
    ],
    "sources": [
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      },
      {
        "title": "Cổng Shopee Affiliate",
        "issuer": "Shopee Việt Nam",
        "url": "https://affiliate.shopee.vn"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "g-link",
    "category": "Tạo liên kết",
    "title": "Cách tạo liên kết tiếp thị",
    "kind": "recommendation",
    "body": [
      "Dán liên kết sản phẩm hoặc shop trên shopee.vn vào trang \"Chuyển đổi liên kết\". Ứng dụng gọi Shopee Open API (generateShortLink) và trả về liên kết rút gọn mang mã của bạn.",
      "Gắn tối đa 5 Sub ID cho mỗi liên kết để biết đơn hàng đến từ kênh hay bài đăng nào. Shopee trả Sub ID về trong báo cáo đơn hàng; đây là cách duy nhất để đo hiệu quả theo từng liên kết."
    ],
    "sources": [
      {
        "title": "Shopee Affiliate Open API",
        "issuer": "Shopee Việt Nam",
        "url": "https://affiliate.shopee.vn/open_api"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Đặt Sub ID ngắn, chỉ gồm chữ và số, ví dụ: tiktok, video12.",
      "Lưu bộ Sub ID hay dùng thành \"Chiến dịch\" để chọn nhanh.",
      "Trang chủ và trang danh mục vẫn tạo được liên kết nhưng không được hoa hồng Xtra."
    ]
  },
  {
    "id": "g-api",
    "category": "Tạo liên kết",
    "title": "Xin quyền Open API (AppID và Secret)",
    "kind": "policy",
    "body": [
      "AppID và Secret lấy tại mục Open API trên cổng Shopee Affiliate. Quyền dùng Open API do Shopee cấp cho từng tài khoản; nếu ứng dụng báo lỗi 10035 nghĩa là tài khoản chưa được cấp quyền và bạn cần gửi yêu cầu cho Shopee.",
      "Tài liệu Open API chỉ xem được sau khi đăng nhập. Open API không cung cấp số lượt nhấp và không có trạng thái \"đã thanh toán\"."
    ],
    "sources": [
      {
        "title": "Shopee Affiliate Open API",
        "issuer": "Shopee Việt Nam",
        "url": "https://affiliate.shopee.vn/open_api"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "g-commission",
    "category": "Hoa hồng và thanh toán",
    "title": "Hoa hồng được ghi nhận thế nào",
    "kind": "policy",
    "body": [
      "Đơn hàng được ghi nhận khi người mua đặt hàng trong vòng 7 ngày sau khi nhấp vào liên kết của bạn (trên cả ứng dụng và web). Có ba loại: Hoa hồng cơ bản, Hoa hồng Xtra và Thưởng. Tỷ lệ áp dụng là tỷ lệ có hiệu lực tại thời điểm đặt hàng.",
      "Hoa hồng tính trên giá trị thuần của đơn hàng thành công, sau khi trừ giảm giá và Shopee Xu. Đơn bị hủy, hoàn trả hoặc bị xác định gian lận không được tính."
    ],
    "sources": [
      {
        "title": "Cách ghi nhận hoa hồng",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/122941"
      },
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Trang shop và trang sản phẩm được hoa hồng Xtra; trang chủ và trang danh mục thì không.",
      "Trong ứng dụng: \"Ước tính\" là đơn chưa hoàn tất, \"Đã xác nhận\" là đơn hoàn tất, \"Bị hủy\" là đơn hủy hoặc gian lận."
    ]
  },
  {
    "id": "g-payment",
    "category": "Hoa hồng và thanh toán",
    "title": "Đối soát và thanh toán",
    "kind": "policy",
    "body": [
      "Dự kiến từ ngày 5 đến ngày 15 của tháng T+1, Shopee gửi email bảng đối soát hoa hồng được duyệt của tháng T. Bạn có 24 giờ để phản hồi nếu có sai lệch.",
      "Thanh toán dự kiến trong vòng 30 ngày làm việc kể từ khi Shopee nhận đủ chứng từ thanh toán hợp lệ. Mức chi trả tối thiểu là 10.000 đồng. Shopee có thể khấu trừ, kê khai và nộp thay thuế theo quy định hiện hành."
    ],
    "sources": [
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Nhập mã đối soát (validationId) từ mục Thanh toán trên cổng Shopee vào trang \"Đơn hàng & Hoa hồng\" để đánh dấu các đơn đã được đối soát."
    ]
  },
  {
    "id": "g-prohibited",
    "category": "Chính sách và hành vi bị cấm",
    "title": "Những việc không được làm",
    "kind": "policy",
    "body": [
      "Vi phạm có thể dẫn đến hủy hoa hồng hoặc khóa tài khoản đối tác."
    ],
    "sources": [
      {
        "title": "Điều khoản Chương trình Tiếp thị liên kết Shopee",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/208515"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Chạy quảng cáo tìm kiếm (SEM) hoặc từ khóa dùng thương hiệu Shopee.",
      "Tạo lượt truy cập hoặc đơn hàng bằng bot, script, công cụ tự động.",
      "Đăng ký hàng loạt hoặc dùng nhiều tài khoản liên kết với nhau.",
      "Tự làm tài liệu quảng cáo nhắc đến Shopee khi chưa được chấp thuận.",
      "Thu thập (scrape) thông tin trên sàn.",
      "Nội dung vi phạm pháp luật, thù ghét hoặc phát tán mã độc.",
      "Quảng bá liên kết hay mã giảm giá chưa được Shopee chấp thuận."
    ]
  },
  {
    "id": "g-optimize",
    "category": "Tối ưu hiệu quả",
    "title": "Gợi ý tối ưu",
    "kind": "recommendation",
    "body": [
      "Đây là khuyến nghị thực hành, không phải yêu cầu của Shopee hay pháp luật."
    ],
    "sources": [],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Mỗi kênh, mỗi nội dung dùng một bộ Sub ID riêng rồi so sánh trong trang \"Thống kê\".",
      "Ưu tiên liên kết tới trang sản phẩm hoặc shop có hoa hồng Xtra.",
      "Theo dõi tỷ lệ đơn bị hủy theo sản phẩm; sản phẩm hủy nhiều làm hoa hồng ước tính cao nhưng thực nhận thấp.",
      "Luôn ghi rõ nội dung có gắn liên kết tiếp thị (xem mục Pháp luật)."
    ]
  },
  {
    "id": "g-faq-click",
    "category": "Câu hỏi thường gặp",
    "title": "Vì sao không thấy số lượt nhấp?",
    "kind": "policy",
    "body": [
      "Shopee Open API không cung cấp số lượt nhấp, nên ứng dụng không hiển thị và không ước lượng. Xem số lượt nhấp trực tiếp trên cổng Shopee Affiliate."
    ],
    "sources": [
      {
        "title": "Shopee Affiliate Open API",
        "issuer": "Shopee Việt Nam",
        "url": "https://affiliate.shopee.vn/open_api"
      }
    ],
    "verified": false,
    "updatedAt": "2026-11-16"
  },
  {
    "id": "g-faq-missing",
    "category": "Câu hỏi thường gặp",
    "title": "Đơn hàng không xuất hiện hoặc hoa hồng thay đổi",
    "kind": "recommendation",
    "body": [
      "Ứng dụng đồng bộ đơn của 30 ngày gần nhất theo lịch và khi bạn bấm \"Đồng bộ ngay\". Hoa hồng ước tính thay đổi khi đơn hoàn tất, bị hủy hoặc hoàn trả. Nếu đồng bộ báo lỗi, xem trạng thái kết nối trong Cài đặt."
    ],
    "sources": [
      {
        "title": "Cách ghi nhận hoa hồng",
        "issuer": "Shopee Việt Nam",
        "url": "https://help.shopee.vn/portal/10/article/122941"
      }
    ],
    "verified": true,
    "updatedAt": "2026-11-16",
    "bullets": [
      "Lỗi 10020: AppID/Secret sai.",
      "Lỗi 10030: vượt giới hạn gọi API, thử lại sau.",
      "Lỗi 10035: tài khoản chưa có quyền Open API."
    ]
  }
];
