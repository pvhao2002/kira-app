import {healthVietnamese} from './health.translations';
import {overviewVietnamese} from './overview.translations';
import {travelVietnamese} from './travel.translations';
import {visitsVietnamese} from './login-visits.translations';
import {usersVietnamese} from './admin-users.translations';
import type {TranslationKey} from './translations';

export const vietnameseTranslations: Record<TranslationKey, string> = {
  ...usersVietnamese,
  ...visitsVietnamese,
  ...travelVietnamese,
  ...healthVietnamese,
  ...overviewVietnamese,
  'language.change': 'Đổi ngôn ngữ',
  'language.english': 'English',
  'language.vietnamese': 'Tiếng Việt',
  'theme.label': 'Giao diện',
  'theme.system': 'Theo hệ thống',
  'theme.light': 'Sáng',
  'theme.dark': 'Tối',
  'common.login': 'Đăng nhập',
  'common.register': 'Đăng ký',
  'common.startFree': 'Bắt đầu miễn phí',
  'common.search': 'Tìm kiếm',
  'common.all': 'Tất cả',
  'common.filter': 'Bộ lọc',
  'common.export': 'Xuất dữ liệu',
  'common.reset': 'Đặt lại',
  'common.addNew': 'Thêm mới',
  'common.edit': 'Sửa',
  'common.actions': 'Thao tác',
  'common.cancel': 'Hủy',
  'common.save': 'Lưu bản ghi',
  'common.viewDetails': 'Xem chi tiết →',
  'common.noLimit': 'Không giới hạn',
  'common.close': 'Đóng',
  'common.previous': 'Trang trước',
  'common.next': 'Trang sau',
  'select.placeholder': 'Chọn một lựa chọn',
  'select.search': 'Tìm tùy chọn…',
  'select.noOptions': 'Không có tùy chọn phù hợp',
  'auth.registerEyebrow': 'Tạo không gian tài chính',
  'auth.loginEyebrow': 'Chào mừng trở lại',
  'auth.registerTitle': 'Bắt đầu với Kira Life',
  'auth.loginTitle': 'Đăng nhập tài khoản',
  'auth.registerDescription': 'Miễn phí, riêng tư và sẵn sàng trong vài phút.',
  'auth.loginDescription': 'Tiếp tục quản lý hai dòng tiền tách bạch.',
  'auth.fullName': 'Họ và tên',
  'auth.fullNamePlaceholder': 'Nguyễn Văn A',
  'auth.email': 'Email',
  'auth.password': 'Mật khẩu',
  'auth.passwordPlaceholder': 'Tối thiểu 8 ký tự',
  'auth.validationError': 'Vui lòng kiểm tra lại các trường bắt buộc.',
  'auth.invalidCredentials': 'Email hoặc mật khẩu không đúng.',
  'auth.invalidEmail': 'Vui lòng nhập email hợp lệ.',
  'auth.invalidPassword': 'Mật khẩu phải có ít nhất 8 ký tự.',
  'auth.adminNotice': 'Tài khoản do Quản trị viên (Admin) cấp. Vui lòng liên hệ Admin nếu bạn chưa có tài khoản.',
  'auth.heroTitle': 'Quản lý Dòng tiền & Cân đối Tài chính',
  'auth.heroDescription': 'Theo dõi thẻ tín dụng, sao kê, thanh toán và hồ sơ tài khoản đầu tư trong một không gian bảo mật.',
  'auth.featureSeparationTitle': 'Hồ sơ tài chính rõ ràng',
  'auth.featureSeparationDesc': 'Dễ dàng đối soát thẻ, sao kê và thanh toán',
  'auth.featureSecurityTitle': 'Bảo mật 256-bit',
  'auth.featureSecurityDesc': 'Dữ liệu mã hóa end-to-end, JWT Rotation',
  'auth.systemOperational': 'Hệ thống hoạt động bình thường · Mã hóa SSL',
  'auth.showPassword': 'Hiện mật khẩu',
  'auth.hidePassword': 'Ẩn mật khẩu',
  'auth.processing': 'Đang xử lý…',
  'auth.createAccount': 'Tạo tài khoản',
  'auth.haveAccount': 'Đã có tài khoản?',
  'auth.noAccount': 'Chưa có tài khoản?',
  'auth.registerNow': 'Đăng ký ngay',
  'shell.closeMenu': 'Đóng menu',
  'shell.openMenu': 'Mở menu',
  'shell.overview': 'Tổng quan',
  'shell.groupCredit': 'THẺ TÍN DỤNG',
  'shell.groupInvestment': 'ĐẦU TƯ',
  'shell.groupAdmin': 'QUẢN TRỊ HỆ THỐNG',
  'shell.adminUsers': 'Quản lý Người dùng',
  'shell.adminBanks': 'Danh mục Ngân hàng',
  'shell.adminAiProviders': 'Tài khoản Cloudflare',
  'shell.groupSystem': 'HỆ THỐNG',
  'shell.dashboard': 'Dashboard',
  'shell.myCards': 'Thẻ của tôi',
  'shell.banks': 'Danh sách ngân hàng',
  'shell.accounts': 'Tài khoản',
  'shell.investmentTransactions': 'Nhập giao dịch',
  'shell.investmentStatistics': 'Thống kê',
  'shell.investmentAiQueue': 'Hàng đợi AI',
  'shell.investmentHistory': 'Lịch sử',
  'shell.notifications': 'Thông báo',
  'shell.settings': 'Cài đặt',
  'shell.secureConnection': 'Kết nối bảo mật',
  'shell.dataProtected': 'Dữ liệu được bảo vệ',
  'shell.searchLabel': 'Tìm kiếm toàn cục',
  'shell.searchPlaceholder': 'Tìm trang, thẻ, ngân hàng, tài khoản…',
  'shell.searchResults': 'Kết quả tìm kiếm toàn cục',
  'shell.searchGroupPages': 'Trang',
  'shell.searchGroupCards': 'Thẻ tín dụng',
  'shell.searchGroupBanks': 'Ngân hàng',
  'shell.searchGroupAccounts': 'Tài khoản đầu tư',
  'shell.searchOpenPage': 'Mở trang',
  'shell.searchLoading': 'Đang tìm kiếm…',
  'shell.searchEmpty': 'Không tìm thấy kết quả phù hợp',
  'shell.searchHint': 'Nhập ít nhất 2 ký tự để tìm dữ liệu',
  'shell.searchPartialError': 'Không thể tìm kiếm từ một số nguồn dữ liệu.',
  'shell.closeSearch': 'Đóng tìm kiếm',
  'shell.openAccountMenu': 'Mở menu tài khoản',
  'shell.preferences': 'Tùy chọn',
  'shell.profile': 'Hồ sơ cá nhân',
  'shell.logout': 'Đăng xuất',
  'dashboard.date': 'Thứ Tư, 22 tháng 7',
  'dashboard.title': 'Tổng quan tài chính',
  'dashboard.greeting': 'Chào buổi chiều. Đây là bức tranh tài chính của bạn hôm nay.',
  'dashboard.changeDateRange': 'Đổi khoảng thời gian',
  'dashboard.last7Days': '7 ngày gần nhất',
  'dashboard.last30Days': '30 ngày gần nhất',
  'dashboard.last90Days': '90 ngày gần nhất',
  'dashboard.flowCredit': 'Thẻ tín dụng',
  'dashboard.goToDashboard': 'Đi đến dashboard →',
  'dashboard.dueSoon': 'Sắp đến hạn',
  'dashboard.next7Days': '7 ngày tới',
  'dashboard.viewAll': 'Xem tất cả',
  'dashboard.dueDate24': 'Hạn 24/07',
  'dashboard.dueDate27': 'Hạn 27/07',
  'dashboard.dueDate29': 'Hạn 29/07',
  'resource.flowCredit': 'THẺ TÍN DỤNG',
  'resource.flowInvestment': 'ĐẦU TƯ',
  'resource.flowSystem': 'HỆ THỐNG',
  'resource.description': 'Theo dõi, tìm kiếm và đối soát dữ liệu của riêng bạn.',
  'resource.searchPlaceholder': 'Tìm kiếm…',
  'resource.filteredRecordCount': '{shown} / {total} bản ghi',
  'resource.recordCount': '{shown} / {total} bản ghi',
  'resource.emptyTitle': 'Chưa có dữ liệu',
  'resource.emptyBody': 'Thêm bản ghi đầu tiên để bắt đầu theo dõi và đối soát.',
  'resource.emptyReadOnlyBody': 'Không có bản ghi để hiển thị.',
  'resource.catalogReadOnly': 'Danh mục này do hệ thống quản lý và chỉ cho phép người dùng xem.',
  'resource.notificationsReadOnly': 'Thông báo do hệ thống tạo. Bạn chỉ có thể đánh dấu đã đọc.',
  'resource.apiUnavailable': 'Chức năng này chưa có API backend nên thao tác thêm và sửa đã được tắt.',
  'resource.useSettings': 'Cập nhật thông tin cá nhân tại trang Cài đặt.',
  'resource.dialogTitle': 'Tạo bản ghi mới',
  'resource.dialogBody': 'Form nghiệp vụ sẽ kiểm tra dữ liệu và gửi mọi phép tính tài chính về backend để xác nhận.',
  'resource.reference': 'Tham chiếu',
  'resource.referencePlaceholder': 'Mã tham chiếu duy nhất',
  'resource.note': 'Ghi chú',
  'resource.notePlaceholder': 'Thông tin bổ sung',
  'form.selectPlaceholder': 'Chọn một giá trị',
  'form.required': 'Trường này là bắt buộc.',
  'form.invalidFormat': 'Giá trị không đúng định dạng.',
  'form.minimum': 'Giá trị tối thiểu là {value}.',
  'form.maximum': 'Giá trị tối đa là {value}.',
  'form.maxLength': 'Tối đa {value} ký tự.',
  'form.invalidValue': 'Vui lòng kiểm tra lại giá trị.',
  'form.confirmDiscard': 'Bỏ các thay đổi chưa lưu?',
  'form.saving': 'Đang lưu…',
  'form.saved': 'Đã lưu thành công.',
  'form.saveFailed': 'Không thể lưu bản ghi.',
  'form.reloadRequired': 'Bản ghi thiếu phiên bản hiện tại. Vui lòng tải lại và thử lại.',
  'form.addCard': 'Thêm thẻ tín dụng',
  'form.addCardDescription': 'Chọn ngân hàng phát hành và nhập các thông tin còn lại của thẻ.',
  'form.editCard': 'Sửa thẻ tín dụng',
  'form.editCardDescription': 'Cập nhật thiết lập thẻ mà không thay đổi ngân hàng phát hành.',
  'form.sharedCreditLimitExistingHint': 'Ngân hàng này đã có hạn mức chung. Tất cả thẻ của ngân hàng cùng sử dụng hạn mức này.',
  'form.sharedCreditLimitEditHint': 'Thay đổi giá trị này sẽ cập nhật hạn mức chung cho mọi thẻ của ngân hàng.',
  'form.billingCycle': 'Cập nhật sao kê tháng',
  'form.billingCycleDescription': 'Nhập số tiền sao kê và xác nhận đã thanh toán toàn bộ dư nợ hay chưa.',
  'form.minimumPaymentExceedsBalance': 'Mức thanh toán tối thiểu không được lớn hơn tổng dư nợ sao kê.',
  'form.minimumPaymentRequired': 'Thanh toán tối thiểu phải lớn hơn 0 khi sao kê có dư nợ.',
  'form.zeroStatementHint': 'Sao kê 0 đồng được tự động hoàn tất và không tạo giao dịch thanh toán.',
  'form.addAccount': 'Thêm tài khoản đầu tư',
  'form.addAccountDescription': 'Tạo hồ sơ cho một tài khoản đầu tư.',
  'form.editAccount': 'Sửa tài khoản đầu tư',
  'form.editAccountDescription': 'Cập nhật hồ sơ và trạng thái tài khoản.',
  'action.markRead': 'Đánh dấu đã đọc',
  'action.enterStatement': 'Nhập sao kê',
  'action.updatePayment': 'Cập nhật thanh toán',
  'option.currencyVnd': 'VND — Việt Nam đồng',
  'option.currencyUsd': 'USD — Đô la Mỹ',
  'option.active': 'Hoạt động',
  'option.inactive': 'Không hoạt động',
  'option.closed': 'Đã đóng',
  'settings.title': 'Cài đặt',
  'settings.description': 'Quản lý hồ sơ, bảo mật và tùy chọn cá nhân.',
  'settings.profileTitle': 'Hồ sơ cá nhân',
  'settings.profileDescription': 'Giữ thông tin tài khoản luôn được cập nhật.',
  'settings.phone': 'Số điện thoại',
  'settings.saveProfile': 'Lưu hồ sơ',
  'settings.profileSaved': 'Đã cập nhật hồ sơ.',
  'settings.securityTitle': 'Bảo mật',
  'settings.securityDescription': 'Sử dụng mật khẩu mạnh và không dùng lại ở nơi khác.',
  'settings.currentPassword': 'Mật khẩu hiện tại',
  'settings.newPassword': 'Mật khẩu mới',
  'settings.confirmPassword': 'Xác nhận mật khẩu mới',
  'settings.passwordMismatch': 'Xác nhận không khớp với mật khẩu mới.',
  'settings.changePassword': 'Đổi mật khẩu',
  'settings.passwordChanged': 'Đã đổi mật khẩu thành công.',
  'settings.appearanceTitle': 'Giao diện và ngôn ngữ',
  'settings.appearanceDescription': 'Chọn cách hiển thị Kira Life.',
  'settings.language': 'Ngôn ngữ',
  'settings.languageDescription': 'Tùy chọn này được lưu trên thiết bị.',
  'error.serverUnavailable': 'Không thể kết nối đến máy chủ',
  'route.login': 'Đăng nhập',
  'route.overview': 'Tổng quan',
  'route.creditDashboard': 'Dashboard thẻ tín dụng',
  'route.adminUsers': 'Quản lý người dùng',
  'route.adminBanks': 'Quản lý ngân hàng',
  'route.adminAiProviders': 'Tài khoản Cloudflare',
  'route.profile': 'Hồ sơ cá nhân',
  'route.banks': 'Danh sách ngân hàng',
  'route.myCards': 'Thẻ của tôi',
  'route.creditReports': 'Báo cáo thẻ tín dụng',
  'route.investmentAccounts': 'Tài khoản đầu tư',
  'route.investmentTransactions': 'Giao dịch đầu tư',
  'route.investmentStatistics': 'Thống kê đầu tư',
  'route.investmentAiQueue': 'Hàng đợi AI đầu tư',
  'route.investmentHistory': 'Lịch sử giao dịch',
  'route.notifications': 'Thông báo',
  'route.settings': 'Cài đặt',
  'aiProviders.eyebrow': 'QUẢN TRỊ · CLOUDFLARE',
  'aiProviders.title': 'Tài khoản Cloudflare',
  'aiProviders.description': 'Quản lý động Workers AI và R2 đã mã hóa, không dùng biến môi trường của provider.',
  'aiProviders.add': 'Thêm account',
  'aiProviders.editTitle': 'Sửa Cloudflare account',
  'aiProviders.createTitle': 'Thêm Cloudflare account',
  'aiProviders.name': 'Tên gợi nhớ',
  'aiProviders.accountId': 'Account ID',
  'aiProviders.accountIdKeep': 'Để trống nếu muốn giữ Account ID hiện tại',
  'aiProviders.token': 'API token',
  'aiProviders.tokenKeep': 'Để trống nếu muốn giữ token hiện tại',
  'aiProviders.priority': 'Độ ưu tiên',
  'aiProviders.priorityHint': 'Số nhỏ hơn sẽ được thử trước.',
  'aiProviders.save': 'Lưu account',
  'aiProviders.loading': 'Đang tải Cloudflare account…',
  'aiProviders.emptyTitle': 'Chưa có account trong database',
  'aiProviders.emptyDescription': 'Hãy thêm và kiểm tra Cloudflare account trước khi dùng Workers AI hoặc R2.',
  'aiProviders.test': 'Kiểm tra',
  'aiProviders.enable': 'Bật',
  'aiProviders.disable': 'Tắt',
  'aiProviders.delete': 'Xóa',
  'aiProviders.testRequired': 'Cần kiểm tra credential thành công trước khi bật.',
  'aiProviders.saved': 'Đã lưu Cloudflare account.',
  'aiProviders.testPassed': 'Credential Cloudflare hợp lệ.',
  'aiProviders.enabled': 'Đã bật Cloudflare account.',
  'aiProviders.disabled': 'Đã tắt Cloudflare account.',
  'aiProviders.deleted': 'Đã xóa Cloudflare account.',
  'aiProviders.deleteConfirm': 'Xóa Cloudflare account này?',
  'aiProviders.status': 'Trạng thái',
  'aiProviders.lastTested': 'Kiểm tra gần nhất',
  'aiProviders.lastSuccess': 'Thành công gần nhất',
  'aiProviders.cooldownUntil': 'Tạm nghỉ tới',
  'aiProviders.lastError': 'Lỗi gần nhất',
  'aiProviders.statusPending': 'Chờ kiểm tra',
  'aiProviders.statusVerified': 'Đã xác minh',
  'aiProviders.statusCooldown': 'Tạm nghỉ',
  'aiProviders.statusBlocked': 'Bị khóa',
  'aiProviders.loadFailed': 'Không thể tải danh sách Cloudflare account.',
  'aiProviders.actionFailed': 'Thao tác Cloudflare account thất bại.',
  'aiProviders.accountSection': 'Cloudflare account',
  'aiProviders.model': 'Model',
  'aiProviders.secretKeep': 'Để trống để giữ secret hiện tại.',
  'aiProviders.r2AccessKey': 'R2 Access Key ID',
  'aiProviders.r2SecretKey': 'R2 Secret Access Key',
  'aiProviders.bucket': 'Bucket',
  'aiProviders.bucketKeep': 'Để trống để giữ bucket hiện tại.',
  'aiProviders.publicUrl': 'Public URL (không bắt buộc)',
  'aiProviders.files': 'File đang lưu',
  'aiProviders.testAi': 'Kiểm tra kết nối AI',
  'aiProviders.testR2': 'Kiểm tra kết nối R2',
  'aiProviders.aiCredentialHint': 'Hãy nhập và lưu API token Workers AI trước khi kiểm tra.',
  'aiProviders.r2CredentialHint': 'Hãy nhập và lưu Access Key ID, Secret Access Key và bucket R2 trước khi kiểm tra.',
  'aiProviders.aiTestPassed': 'Đã xác minh Workers AI credential và model.',
  'aiProviders.r2TestPassed': 'Đã xác minh quyền upload, đọc và xóa trên R2.',
  'aiProviders.makePrimary': 'Chọn làm primary',
  'aiProviders.stopUploads': 'Ngừng nhận upload',
  'aiProviders.r2PrimaryStatus': 'Primary',
  'aiProviders.r2Primary': 'R2 account này đang nhận upload mới.',
  'aiProviders.r2Stopped': 'R2 account này đã ngừng nhận upload mới.',
  'aiProviders.adoptLegacy': 'Gán file cũ',
  'aiProviders.adoptConfirm': 'Gán {count} file cũ vào R2 account này? Hệ thống không thể tự xác định bucket.',
  'aiProviders.adopted': 'Đã gán file cũ vào R2 account này.',
  'investmentTransactions.eyebrow': 'ĐẦU TƯ · DUYỆT AI',
  'investmentTransactions.historyEyebrow': 'ĐẦU TƯ · LỊCH SỬ',
  'investmentTransactions.description': 'Đưa ảnh giao dịch vào hàng đợi AI, duyệt từng kết quả rồi mới lưu vào lịch sử.',
  'investmentTransactions.account': 'Tài khoản',
  'investmentTransactions.accountPlaceholder': 'Chọn tài khoản',
  'investmentTransactions.type': 'Loại',
  'investmentTransactions.uploadTitle': '1. Chọn ảnh giao dịch',
  'investmentTransactions.uploadDescription': 'Tối đa 10 ảnh JPEG/PNG/WebP, 10 MB mỗi ảnh và 50 MB mỗi lô.',
  'investmentTransactions.dropTitle': 'Kéo thả ảnh vào đây',
  'investmentTransactions.dropHint': 'hoặc bấm để chọn từ thiết bị, hay dán ảnh từ clipboard',
  'investmentTransactions.removeFile': 'Bỏ {name}',
  'investmentTransactions.uploading': 'Đang tải ảnh…',
  'investmentTransactions.createBatch': 'Tạo lô xử lý AI',
  'investmentTransactions.batchTitle': '2. Trạng thái xử lý',
  'investmentTransactions.detected': 'Phát hiện',
  'investmentTransactions.review': 'Cần duyệt',
  'investmentTransactions.inserted': 'Đã thêm',
  'investmentTransactions.updated': 'Đã cập nhật',
  'investmentTransactions.failed': 'Lỗi',
  'investmentTransactions.retryFile': 'Thử lại ảnh',
  'investmentTransactions.reviewTitle': '3. Duyệt và chỉnh sửa',
  'investmentTransactions.reviewDescription': 'Hệ thống sẽ chuẩn hóa và kiểm tra trùng lặp lần nữa khi xác nhận.',
  'investmentTransactions.confirmSelected': 'Xác nhận các mục đã chọn',
  'investmentTransactions.selectItem': 'Chọn {id}',
  'investmentTransactions.action': 'Thao tác',
  'investmentTransactions.dateTime': 'Ngày giờ',
  'investmentTransactions.externalId': 'Mã giao dịch bên ngoài',
  'investmentTransactions.resolution': 'Xử lý',
  'investmentTransactions.warnings': '{count} cảnh báo',
  'investmentTransactions.notSelected': 'Chưa chọn',
  'investmentTransactions.unknownValue': 'Không xác định',
  'investmentTransactions.confirmResult': 'Kết quả xác nhận',
  'investmentTransactions.createdCount': '{count} thêm mới',
  'investmentTransactions.updatedCount': '{count} cập nhật',
  'investmentTransactions.skippedCount': '{count} bỏ qua',
  'investmentTransactions.failedCount': '{count} lỗi',
  'investmentTransactions.historyTitle': 'Lịch sử giao dịch',
  'investmentTransactions.historyDescription': 'Lịch sử này độc lập, không làm thay đổi số dư hoặc sổ cái.',
  'investmentTransactions.historyResults': '{count} giao dịch',
  'investmentTransactions.showFilters': 'Hiện bộ lọc',
  'investmentTransactions.hideFilters': 'Ẩn bộ lọc',
  'investmentTransactions.fromDate': 'Từ ngày',
  'investmentTransactions.toDate': 'Đến ngày',
  'investmentTransactions.allTypes': 'Tất cả loại',
  'investmentTransactions.allStatuses': 'Tất cả trạng thái',
  'investmentTransactions.filter': 'Lọc',
  'investmentTransactions.invalidDateRange': 'Từ ngày phải trước hoặc bằng đến ngày.',
  'investmentTransactions.loadingHistory': 'Đang tải lịch sử…',
  'investmentTransactions.emptyHistory': 'Chưa có giao dịch đã xác nhận.',
  'investmentTransactions.emptyHistoryTitle': 'Chưa có giao dịch đã xác nhận',
  'investmentTransactions.emptyHistoryDescription': 'Các giao dịch đã xác nhận của tài khoản đầu tư này sẽ xuất hiện tại đây.',
  'investmentTransactions.emptyFilteredTitle': 'Không có giao dịch phù hợp',
  'investmentTransactions.emptyFilteredDescription': 'Hãy thay đổi hoặc xóa các điều kiện lọc hiện tại.',
  'investmentTransactions.clearFilters': 'Xóa bộ lọc',
  'investmentTransactions.paginationRange': '{start}–{end} trên tổng {total} giao dịch',
  'investmentTransactions.paginationPage': 'Trang {current}/{total}',
  'investmentTransactions.resolutionTitle': 'Xử lý giao dịch {action}',
  'investmentTransactions.resolutionDescription': 'Chọn cách hệ thống xử lý sau khi chuẩn hóa và kiểm tra trùng lặp. Chỉ chọn “Lưu như giao dịch mới” khi đây thật sự là hai giao dịch khác nhau.',
  'investmentTransactions.resolution.accept': 'Chấp nhận',
  'investmentTransactions.resolution.acceptDescription': 'Lưu dữ liệu đã duyệt nếu hệ thống không còn phát hiện xung đột.',
  'investmentTransactions.resolution.mergeExisting': 'Gộp với bản ghi có sẵn',
  'investmentTransactions.resolution.mergeExistingDescription': 'Giữ giao dịch hiện có, chỉ cập nhật trạng thái hoặc bổ sung thông tin.',
  'investmentTransactions.resolution.saveAsNew': 'Lưu như giao dịch mới',
  'investmentTransactions.resolution.saveAsNewDescription': 'Tạo dấu định danh riêng cho giao dịch cùng phút không có mã giao dịch bên ngoài.',
  'investmentTransactions.resolution.skip': 'Bỏ qua',
  'investmentTransactions.resolution.skipDescription': 'Không lưu giao dịch này.',
  'investmentTransactions.type.deposit': 'Nạp tiền',
  'investmentTransactions.type.withdrawal': 'Rút tiền',
  'investmentTransactions.type.bonus': 'Thưởng',
  'investmentTransactions.status.pending': 'Chờ xử lý',
  'investmentTransactions.status.completed': 'Hoàn thành',
  'investmentTransactions.status.failed': 'Thất bại',
  'investmentTransactions.status.cancelled': 'Đã hủy',
  'investmentTransactions.importStatus.queued': 'Đang xếp hàng',
  'investmentTransactions.importStatus.processing': 'Đang xử lý',
  'investmentTransactions.importStatus.ready': 'Sẵn sàng',
  'investmentTransactions.importStatus.readyWithErrors': 'Sẵn sàng, có lỗi',
  'investmentTransactions.importStatus.partiallyConfirmed': 'Đã xác nhận một phần',
  'investmentTransactions.importStatus.confirmed': 'Đã xác nhận',
  'investmentTransactions.importStatus.failed': 'Thất bại',
  'investmentTransactions.importStatus.cancelled': 'Đã hủy',
  'investmentTransactions.action.insert': 'Thêm mới',
  'investmentTransactions.action.update': 'Cập nhật',
  'investmentTransactions.action.duplicate': 'Trùng lặp',
  'investmentTransactions.action.review': 'Cần duyệt',
  'investmentTransactions.action.ignore': 'Bỏ qua',
  'investmentTransactions.errorAccountLoad': 'Không thể tải danh sách tài khoản đầu tư.',
  'investmentTransactions.errorCreateBatch': 'Không thể tạo lô nhập giao dịch.',
  'investmentTransactions.errorRetryFile': 'Không thể thử lại ảnh.',
  'investmentTransactions.errorConfirm': 'Không thể xác nhận lô giao dịch.',
  'investmentTransactions.errorHistoryLoad': 'Không thể tải lịch sử giao dịch.',
  'investmentTransactions.deleteDirty': 'Xoá',
  'investmentTransactions.deleteConfirmTitle': 'Xoá giao dịch này?',
  'investmentTransactions.deleteConfirmDescription': 'Giao dịch này chưa có mã tham chiếu bên ngoài và có thể là dữ liệu lỗi. Không thể hoàn tác sau khi xoá.',
  'investmentTransactions.deleteConfirm': 'Xoá',
  'investmentTransactions.deleting': 'Đang xoá…',
  'investmentTransactions.deletedToast': 'Đã xoá giao dịch.',
  'investmentTransactions.errorDelete': 'Không thể xoá giao dịch này.',
  'investmentTransactions.errorPolling': 'Mất kết nối khi cập nhật trạng thái AI. Bạn có thể tải lại trang.',
  'investmentTransactions.errorBatchLoad': 'Không thể tải lại kết quả lô giao dịch.',
  'investmentTransactions.errorReviewTarget': 'Batch cần review không tồn tại hoặc không thuộc tài khoản của bạn.',
  'investmentTransactions.reviewWaitingTitle': 'AI vẫn đang xử lý batch này',
  'investmentTransactions.reviewWaitingDescription': 'Trang sẽ tiếp tục tự cập nhật. Nút xác nhận chỉ xuất hiện khi batch đã sẵn sàng để review.',
  'investmentTransactions.reviewConfirmedTitle': 'Batch này đã được xác nhận',
  'investmentTransactions.reviewConfirmedDescription': 'Thông tin bên trên chỉ để xem. Các giao dịch đã xác nhận nằm trong lịch sử giao dịch.',
  'investmentTransactions.reviewUnavailableTitle': 'Batch này chưa thể xác nhận',
  'investmentTransactions.reviewUnavailableDescription': 'Hãy kiểm tra lỗi của từng ảnh hoặc chạy lại các ảnh thất bại trước khi tiếp tục.',
  'investmentTransactions.errorTooManyFiles': 'Mỗi batch chỉ được tối đa 10 ảnh.',
  'investmentTransactions.errorInvalidFiles': 'Chỉ nhận JPEG, PNG, WebP; mỗi ảnh từ 1 byte đến 10 MB.',
  'investmentTransactions.errorTotalSize': 'Tổng dung lượng của lô không được vượt 50 MB.',
  'investmentStatistics.eyebrow': 'ĐẦU TƯ · THỐNG KÊ',
  'investmentStatistics.title': 'Thống kê đầu tư',
  'investmentStatistics.description': 'Theo dõi dòng tiền đã hoàn tất và các việc đầu tư đang tồn đọng.',
  'investmentStatistics.refresh': 'Làm mới',
  'investmentStatistics.account': 'Tài khoản',
  'investmentStatistics.searchAccount': 'Tìm tài khoản',
  'investmentStatistics.allAccounts': 'Tất cả tài khoản',
  'investmentStatistics.from': 'Từ ngày',
  'investmentStatistics.to': 'Đến ngày',
  'investmentStatistics.quickRange': 'Khoảng nhanh',
  'investmentStatistics.apply': 'Áp dụng',
  'investmentStatistics.currency': 'Tiền tệ',
  'investmentStatistics.cashFlow': 'Dòng tiền',
  'investmentStatistics.completedHint': 'Chỉ tính giao dịch đã hoàn tất. Dòng tiền ròng = nạp + thưởng − rút.',
  'investmentStatistics.deposits': 'Nạp',
  'investmentStatistics.withdrawals': 'Rút',
  'investmentStatistics.bonuses': 'Thưởng',
  'investmentStatistics.net': 'Dòng tiền ròng',
  'investmentStatistics.netFlowMode': 'Công thức dòng tiền ròng',
  'investmentStatistics.netFlowModeWithdrawalMinusDeposit': 'Rút − Nạp',
  'investmentStatistics.netFlowModeWithdrawalPlusBonusMinusDeposit': 'Rút + Thưởng − Nạp',
  'investmentStatistics.transactions': 'Giao dịch',
  'investmentStatistics.daily': 'Dòng tiền theo ngày',
  'investmentStatistics.netDaily': 'Dòng tiền ròng theo ngày',
  'investmentStatistics.netMonthly': 'Dòng tiền ròng theo tháng',
  'investmentStatistics.noFlow': 'Không có giao dịch hoàn tất trong khoảng này.',
  'investmentStatistics.byAccount': 'Theo tài khoản',
  'investmentStatistics.statusLabel': 'Trạng thái',
  'investmentStatistics.noAccounts': 'Chưa có tài khoản đầu tư.',
  'investmentStatistics.current': 'TỒN ĐỌNG HIỆN TẠI',
  'investmentStatistics.operations': 'Vận hành',
  'investmentStatistics.currentHint': 'Tồn đọng hiện tại không phụ thuộc khoảng ngày đã chọn.',
  'investmentStatistics.openQueue': 'Mở hàng đợi AI',
  'investmentStatistics.aiPending': 'AI đang chờ',
  'investmentStatistics.aiProcessing': 'AI đang xử lý',
  'investmentStatistics.aiReady': 'AI sẵn sàng',
  'investmentStatistics.aiFailed': 'AI lỗi',
  'investmentStatistics.importReview': 'Import cần duyệt',
  'investmentStatistics.reconciliation': 'Đối soát',
  'investmentStatistics.noPending': 'Không có tồn đọng hiện tại.',
  'investmentStatistics.reason': 'Lý do',
  'investmentStatistics.detail': 'Chi tiết',
  'investmentStatistics.history': 'Lịch sử',
  'investmentStatistics.noHistory': 'Chưa có lịch sử.',
  'investmentStatistics.loading': 'Đang tải thống kê…',
  'investmentStatistics.error': 'Không thể tải phần này.',
  'investmentStatistics.retry': 'Thử lại',
  'investmentStatistics.status.active': 'Đang hoạt động',
  'investmentStatistics.status.inactive': 'Ngừng hoạt động',
  'investmentStatistics.status.open': 'Mở',
  'investmentStatistics.status.in_review': 'Đang xem xét',
  'investmentStatistics.status.needs_info': 'Cần bổ sung',
  'investmentStatistics.status.resolved': 'Đã xử lý',
  'investmentStatistics.status.rejected': 'Từ chối',
  'investmentTransactions.processedToast': 'Đã xử lý {count} giao dịch.',
  'investmentTransactions.trace': 'Mã theo dõi {id}',
  'investmentAiQueue.eyebrow': 'ĐẦU TƯ · VẬN HÀNH AI',
  'investmentAiQueue.title': 'Hàng đợi xử lý AI',
  'investmentAiQueue.description': 'Theo dõi job đọc ảnh giao dịch, xem kết quả chuẩn hóa và điều khiển an toàn các job đang chờ.',
  'investmentAiQueue.refresh': 'Làm mới',
  'investmentAiQueue.filters': 'Bộ lọc hàng đợi',
  'investmentAiQueue.scope': 'Phạm vi hàng đợi',
  'investmentAiQueue.allJobs': 'Tất cả job',
  'investmentAiQueue.myJobs': 'Job của tôi',
  'investmentAiQueue.statusLabel': 'Trạng thái',
  'investmentAiQueue.status.all': 'Tất cả trạng thái',
  'investmentAiQueue.status.pending': 'Đang chờ',
  'investmentAiQueue.status.processing': 'Đang xử lý',
  'investmentAiQueue.status.ready': 'Sẵn sàng',
  'investmentAiQueue.status.failed': 'Thất bại',
  'investmentAiQueue.status.cancelled': 'Đã hủy',
  'investmentAiQueue.status.confirmed': 'Đã xác nhận',
  'investmentAiQueue.liveRefresh': 'Tự cập nhật mỗi 5 giây',
  'investmentAiQueue.errorTitle': 'Lỗi hàng đợi:',
  'investmentAiQueue.jobs': 'Danh sách job xử lý',
  'investmentAiQueue.resultCount': '{count} job',
  'investmentAiQueue.updating': 'Đang cập nhật…',
  'investmentAiQueue.loading': 'Đang tải AI job…',
  'investmentAiQueue.emptyTitle': 'Không có AI job phù hợp',
  'investmentAiQueue.emptyDescription': 'Job tạo từ ảnh giao dịch đầu tư sẽ xuất hiện tại đây.',
  'investmentAiQueue.job': 'Job và tệp',
  'investmentAiQueue.owner': 'Người sở hữu',
  'investmentAiQueue.attempts': 'Số lần chạy',
  'investmentAiQueue.timeline': 'Thời gian xử lý',
  'investmentAiQueue.modelPending': 'Chưa gán model',
  'investmentAiQueue.created': 'Tạo lúc',
  'investmentAiQueue.started': 'Bắt đầu',
  'investmentAiQueue.completed': 'Hoàn tất',
  'investmentAiQueue.viewImage': 'Xem ảnh',
  'investmentAiQueue.viewJson': 'JSON detect',
  'investmentAiQueue.run': 'Chạy',
  'investmentAiQueue.rerun': 'Chạy lại',
  'investmentAiQueue.reviewAndConfirm': 'Review & Confirm',
  'investmentAiQueue.reviewOwnerOnly': 'Chỉ owner mới có thể review và xác nhận job này.',
  'investmentAiQueue.reviewUnavailable': 'Không có import batch nào đang chờ review.',
  'investmentAiQueue.reviewTargetEyebrow': 'ĐÍCH ĐẾN REVIEW',
  'investmentAiQueue.reviewTargetTitle': 'Chọn tài khoản và batch',
  'investmentAiQueue.reviewTargetDescription': 'Job #{id} đang được dùng trong nhiều import đang mở. Hãy chọn batch cần review.',
  'investmentAiQueue.pendingItems': '{count} item đang chờ review',
  'investmentAiQueue.pagination': 'Hiển thị {start}–{end} trên {total}',
  'investmentAiQueue.confirmCancelTitle': 'Hủy job đang chờ?',
  'investmentAiQueue.confirmCancelDescription': 'Job #{id} sẽ được loại khỏi hàng chờ. Ảnh nguồn vẫn được giữ lại.',
  'investmentAiQueue.confirmCancel': 'Hủy job',
  'investmentAiQueue.detectedJson': 'JSON detect đã chuẩn hóa',
  'investmentAiQueue.normalizedJsonNotice': 'Đây là draft đã kiểm tra riêng cho ảnh này. Phản hồi chung của batch từ provider không được trả ra.',
  'investmentAiQueue.sourceImage': 'Ảnh nguồn',
  'investmentAiQueue.loadingImage': 'Đang tải ảnh nguồn…',
  'investmentAiQueue.imageError': 'Không thể tải ảnh nguồn hoặc ảnh đã hết hạn lưu trữ.',
  'investmentAiQueue.loadError': 'Không thể cập nhật hàng đợi AI. Dữ liệu hiện có vẫn được giữ.',
  'investmentAiQueue.actionError': 'Job đã thay đổi hoặc thao tác không còn hợp lệ. Hàng đợi sẽ tự cập nhật.',
  'investmentAiQueue.cancelledToast': 'Đã hủy job #{id}.',
  'investmentAiQueue.runningToast': 'Job #{id} đang được chạy ngay.',
  'investmentAiQueue.completedToast': 'Job #{id} hoàn tất với trạng thái {status}.',
  'field.id': 'ID',
  'field.fullName': 'Họ và tên',
  'field.email': 'Email',
  'field.name': 'Tên',
  'field.code': 'Mã',
  'field.status': 'Trạng thái',
  'field.amount': 'Số tiền',
  'field.description': 'Mô tả',
  'field.createdAt': 'Ngày tạo',
  'field.updatedAt': 'Ngày cập nhật',
  'field.bankName': 'Ngân hàng',
  'field.cardName': 'Thẻ',
  'field.reference': 'Tham chiếu'
  ,'field.bankId': 'Ngân hàng'
  ,'field.sequence': 'STT'
  ,'field.cardType': 'Loại thẻ'
  ,'field.nickname': 'Card holder (Chủ thẻ)'
  ,'field.lastFour': 'Bốn số cuối'
  ,'field.creditLimit': 'Hạn mức tín dụng'
  ,'field.statementDay': 'Ngày sao kê'
  ,'field.dueDay': 'Ngày thanh toán'
  ,'field.billingStatus': 'Kỳ thanh toán hiện tại'
  ,'field.statementBalance': 'Tổng dư nợ sao kê'
  ,'field.minimumPayment': 'Mức thanh toán tối thiểu'
  ,'field.paymentStatus': 'Trạng thái thanh toán'
  ,'format.dayOfMonth': 'Ngày {value}'
  ,'billing.not_due': 'Chưa đến ngày sao kê'
  ,'billing.needs_input': 'Cần nhập sao kê'
  ,'billing.unpaid': 'Chưa thanh toán'
  ,'billing.overdue': 'Quá hạn'
  ,'billing.paid': 'Đã thanh toán'
  ,'billing.statementOn': 'Sao kê {date}'
  ,'billing.dueOn': 'Hạn {date}'
  ,'field.note': 'Ghi chú'
  ,'field.currency': 'Tiền tệ'
  ,'field.referenceNumber': 'Mã tham chiếu'
  ,'field.accountCode': 'Mã tài khoản'
  ,'field.accountName': 'Tên tài khoản'
  ,'field.accountUsername': 'Tên đăng nhập'
  ,'field.accountEmail': 'Email đăng ký'
  ,'field.phoneNumber': 'Số điện thoại'
  ,'field.registerDate': 'Ngày đăng ký'
  ,'field.accountPassword': 'Mật khẩu tài khoản'
  ,'field.songTitle': 'Tên bài hát'
  ,'field.artist': 'Ca sĩ'
  ,'field.genre': 'Thể loại'
  ,'field.karaokeCode': 'Mã karaoke'
  ,'field.tone': 'Tone / tông'
  ,'field.musicLink': 'Link bài hát'
  ,'field.companyName': 'Công ty'
  ,'field.positionTitle': 'Vị trí tuyển dụng'
  ,'field.location': 'Địa điểm'
  ,'field.jobUrl': 'Link công việc'
  ,'field.salary': 'Mức lương'
  ,'field.employmentType': 'Loại hình làm việc'
  ,'field.priority': 'Độ ưu tiên'
  ,'field.deadline': 'Hạn ứng tuyển'
  ,'field.contactName': 'Người liên hệ'
  ,'field.contactEmail': 'Email liên hệ'
  ,'option.fullTime': 'Toàn thời gian'
  ,'option.partTime': 'Bán thời gian'
  ,'option.contract': 'Hợp đồng'
  ,'option.freelance': 'Freelance'
  ,'option.internship': 'Thực tập'
  ,'option.other': 'Khác'
  ,'job.statusSaved': 'Đã lưu'
  ,'job.statusApplied': 'Đã ứng tuyển'
  ,'job.statusInterview': 'Phỏng vấn'
  ,'job.statusOffer': 'Offer'
  ,'job.statusRejected': 'Từ chối'
  ,'job.statusWithdrawn': 'Đã rút hồ sơ'
  ,'job.priorityLow': 'Thấp'
  ,'job.priorityMedium': 'Trung bình'
  ,'job.priorityHigh': 'Cao'
  ,'datepicker.selectDate': 'Chọn ngày'
  ,'datepicker.selectDateTime': 'Chọn ngày & giờ'
  ,'datepicker.selectDatePlaceholder': 'Chọn ngày...'
  ,'datepicker.selectDateTimePlaceholder': 'Chọn ngày & giờ...'
  ,'datepicker.today': 'Hôm nay'
  ,'datepicker.plus1Day': '+1 ngày'
  ,'datepicker.plus7Days': '+7 ngày'
  ,'datepicker.plus30Days': '+30 ngày'
  ,'datepicker.endOfMonth': 'Cuối tháng'
  ,'datepicker.prevMonth': 'Tháng trước'
  ,'datepicker.nextMonth': 'Tháng sau'
  ,'datepicker.timeTitle': 'Thời gian (Giờ : Phút)'
  ,'datepicker.clear': 'Xóa'
  ,'datepicker.apply': 'Áp dụng'
  ,'bank.eyebrow': 'Quản lý hệ thống'
  ,'bank.title': 'Ngân hàng'
  ,'bank.description': 'Tra cứu và quản lý danh sách ngân hàng đối tác.'
  ,'bank.addBank': 'Thêm ngân hàng'
  ,'bank.statBanks': 'Tổng ngân hàng'
  ,'bank.searchPlaceholder': 'Tìm kiếm ngân hàng theo tên hoặc mã…'
  ,'bank.allBanks': 'Tất cả ngân hàng'
  ,'bank.sectionBanks': 'Danh mục Ngân hàng đối tác'
  ,'bank.bankCount': '{n} ngân hàng'
  ,'bank.website': 'Website'
  ,'bank.dialogBankEyebrow': 'Quản lý Ngân hàng'
  ,'bank.dialogBankTitle': 'Thêm ngân hàng mới'
  ,'bank.dialogBankDesc': 'Nhập thông tin cho ngân hàng đối tác mới.'
  ,'bank.fieldCode': 'Mã ngân hàng (Code)'
  ,'bank.fieldCodePlaceholder': 'Ví dụ: TCB, VCB, VPB…'
  ,'bank.fieldShortName': 'Tên viết tắt (Short Name)'
  ,'bank.fieldShortNamePlaceholder': 'Ví dụ: Techcombank, Vietcombank…'
  ,'bank.fieldFullName': 'Tên đầy đủ ngân hàng'
  ,'bank.fieldFullNamePlaceholder': 'Ví dụ: Ngân hàng TMCP Kỹ Thương Việt Nam…'
  ,'bank.fieldLogoUrl': 'Link Logo Ngân hàng (URL)'
  ,'bank.fieldHotline': 'Số hotline'
  ,'bank.fieldHotlinePlaceholder': '1900xxxx'
  ,'bank.fieldWebsite': 'Website'
  ,'bank.fieldWebsitePlaceholder': 'https://bank.com.vn'
  ,'field.currentBalance': 'Hạn mức còn lại'
  ,'creditCards.cardCount': '{count} thẻ'
  ,'creditCards.cardTypeMissing': 'Chưa cập nhật'
  ,'creditCards.totalAllBanks': 'Tổng tất cả ngân hàng'
  ,'creditCards.totalCreditLimit': 'Tổng hạn mức'
  ,'creditCards.totalBalance': 'Tổng hạn mức còn lại'
  ,'creditCards.previewTitle': 'Xem trước thẻ trực quan'
  ,'creditBalance.edit': 'Sửa hạn mức còn lại'
  ,'creditBalance.editFor': 'Sửa hạn mức còn lại của {bank}'
  ,'creditBalance.editDescription': 'Nhập hạn mức còn lại. Hệ thống lưu điều chỉnh mà không sửa lại các kỳ sao kê.'
  ,'creditBalance.currentValue': 'Hạn mức còn lại hiện tại'
  ,'creditBalance.rangeHint': 'Nhập số tiền từ 0 đến {limit}.'
  ,'creditBalance.reason': 'Lý do điều chỉnh'
  ,'creditBalance.reasonRequired': 'Vui lòng nhập lý do không quá 500 ký tự.'
  ,'creditDashboard.eyebrow': 'THẺ TÍN DỤNG'
  ,'creditDashboard.title': 'Tổng quan dư nợ thẻ'
  ,'creditDashboard.description': 'Theo dõi dư nợ sao kê, dư nợ hiện tại và mức sử dụng theo ngân hàng.'
  ,'creditDashboard.totalStatementDebt': 'Tổng dư nợ sao kê'
  ,'creditDashboard.currentBalance': 'Hạn mức còn lại'
  ,'creditDashboard.totalCreditLimit': 'Tổng hạn mức'
  ,'creditDashboard.availableCredit': 'Hạn mức còn lại'
  ,'creditDashboard.usedCredit': 'Đã sử dụng'
  ,'creditDashboard.utilization': 'Đã dùng {value}%'
  ,'creditDashboard.usageByBank': 'Mức sử dụng theo ngân hàng'
  ,'creditDashboard.usageByBankDescription': 'Số tiền đã sử dụng trên tổng hạn mức tín dụng'
  ,'creditDashboard.chartAria': 'Số tiền đã sử dụng chia cho tổng hạn mức của từng ngân hàng'
  ,'creditDashboard.mobileBankOverview': 'Tổng quan theo ngân hàng'
  ,'creditDashboard.mobileBankDescription': 'Chọn ngân hàng để xem chi tiết dư nợ và thẻ.'
  ,'creditDashboard.cardList': 'Danh sách thẻ'
  ,'creditDashboard.debtDetail': 'Chi tiết dư nợ'
  ,'creditDashboard.debtDetailDescription': 'Mở rộng ngân hàng để xem từng thẻ tín dụng.'
  ,'creditDashboard.bankCard': 'Ngân hàng / Thẻ'
  ,'creditDashboard.statementDebt': 'Dư nợ sao kê'
  ,'creditDashboard.creditLimit': 'Hạn mức'
  ,'creditDashboard.available': 'Còn lại'
  ,'creditDashboard.used': 'Đã dùng'
  ,'creditDashboard.utilizationColumn': 'Mức sử dụng'
  ,'creditDashboard.status': 'Trạng thái'
  ,'creditDashboard.cards': '{count} thẻ'
  ,'creditDashboard.lastFour': '•••• {value}'
  ,'creditDashboard.overLimit': 'Vượt hạn mức'
  ,'creditDashboard.sharedLimit': 'Dùng chung'
  ,'creditDashboard.sharedBalance': 'Dùng chung'
  ,'creditDashboard.editLimit': 'Sửa hạn mức'
  ,'creditDashboard.editLimitFor': 'Sửa hạn mức chung của {bank}'
  ,'creditDashboard.editLimitDescription': 'Hạn mức này được dùng chung cho tất cả thẻ thuộc ngân hàng.'
  ,'creditDashboard.totalAllBanks': 'Tổng tất cả ngân hàng'
  ,'creditDashboard.expandBank': 'Hiện các thẻ của {bank}'
  ,'creditDashboard.collapseBank': 'Ẩn các thẻ của {bank}'
  ,'creditDashboard.emptyTitle': 'Chưa có dữ liệu thẻ tín dụng'
  ,'creditDashboard.emptyDescription': 'Thêm thẻ tín dụng để bắt đầu theo dõi dư nợ.'
  ,'creditDashboard.errorTitle': 'Không thể tải dữ liệu dư nợ thẻ'
  ,'creditDashboard.retry': 'Thử lại'
  ,'bank.saveBank': 'Lưu ngân hàng'
  ,'lodging.eyebrow': 'TÌM TRỌ'
  ,'lodging.title': 'Thông tin tìm trọ'
  ,'lodging.description': 'Lưu tin trọ dùng chung, chi phí, khoảng cách và review tại một nơi.'
  ,'lodging.add': 'Thêm tin trọ'
  ,'lodging.edit': 'Sửa tin trọ'
  ,'lodging.search': 'Tìm địa chỉ, note hoặc số điện thoại…'
  ,'lodging.addLocation': 'Thêm địa điểm chung'
  ,'lodging.loading': 'Đang tải danh sách trọ…'
  ,'lodging.empty': 'Chưa có thông tin trọ'
  ,'lodging.emptyDescription': 'Thêm một tin để bắt đầu so sánh.'
  ,'lodging.by': 'Người tạo'
  ,'lodging.month': 'tháng'
  ,'lodging.images': 'ảnh'
  ,'lodging.electricity': 'Điện'
  ,'lodging.water': 'Nước'
  ,'lodging.service': 'Dịch vụ'
  ,'lodging.parking': 'Giữ xe'
  ,'lodging.calculating': 'Đang tính…'
  ,'lodging.distanceFailed': 'Chưa tính được km'
  ,'lodging.notOk': 'Không OK'
  ,'lodging.review': 'Review'
  ,'lodging.retry': 'Tính lại km'
  ,'lodging.delete': 'Xóa'
  ,'lodging.deleteConfirm': 'Xóa thông tin trọ này?'
  ,'lodging.deleted': 'Đã xóa tin trọ'
  ,'lodging.saved': 'Đã lưu tin trọ'
  ,'lodging.saveFailed': 'Không thể lưu tin trọ'
  ,'lodging.loadFailed': 'Không thể tải danh sách trọ'
  ,'lodging.uploadFailed': 'Tải ảnh lên thất bại'
  ,'lodging.retryFailed': 'Không thể tính lại khoảng cách'
  ,'lodging.address': 'Địa chỉ'
  ,'lodging.rent': 'Giá thuê/tháng (VND)'
  ,'lodging.phone': 'Số điện thoại'
  ,'lodging.locations': 'Địa điểm so sánh'
  ,'lodging.selectLocation': 'Chọn ít nhất một địa điểm.'
  ,'lodging.note': 'Ghi chú'
  ,'lodging.locationName': 'Tên địa điểm'
  ,'lodging.reason': 'Lý do'
  ,'lodging.reviewReasonRequired': 'Review Không OK cần nhập lý do.'
  ,'lodging.reviewHistory': 'Lịch sử review'
  ,'lodging.reviewSaved': 'Đã lưu review'
  ,'shell.groupLodging': 'TÌM TRỌ'
  ,'shell.lodgings': 'Tìm trọ'
  ,'shell.creditBenefits': 'Ưu đãi & hoàn tiền'
  ,'route.creditBenefits': 'Ưu đãi và hoàn tiền thẻ'
  ,'creditBenefits.eyebrow': 'ƯU ĐÃI THẺ'
  ,'creditBenefits.title': 'Ưu đãi & hoàn tiền'
  ,'creditBenefits.description': 'Quản lý chương trình hoàn tiền, nhóm MCC và trần tháng của từng thẻ.'
  ,'creditBenefits.addProgram': 'Thêm chương trình'
  ,'creditBenefits.loadFailed': 'Không thể tải cấu hình ưu đãi thẻ.'
  ,'creditBenefits.reload': 'Tải lại'
  ,'creditBenefits.loading': 'Đang tải ưu đãi thẻ…'
  ,'creditBenefits.noCards': 'Chưa có thẻ tín dụng'
  ,'creditBenefits.noCardsDescription': 'Hãy thêm thẻ tín dụng trước khi cấu hình ưu đãi.'
  ,'creditBenefits.chooseCard': 'Thẻ cần cấu hình'
  ,'creditBenefits.cardTypeMissing': 'Chưa cập nhật loại thẻ'
  ,'creditBenefits.monthlyCap': 'Tổng tiền hoàn tối đa mỗi tháng'
  ,'creditBenefits.monthlyCapDescription': 'Trần chung theo tháng dương lịch cho tất cả chương trình đang bật của thẻ.'
  ,'creditBenefits.amountIn': 'Số tiền ({currency})'
  ,'creditBenefits.saving': 'Đang lưu…'
  ,'creditBenefits.saveCap': 'Lưu trần tháng'
  ,'creditBenefits.capInvalid': 'Nhập trần hoàn tiền tháng lớn hơn 0.'
  ,'creditBenefits.capSaved': 'Đã lưu trần hoàn tiền tháng.'
  ,'creditBenefits.saveFailed': 'Không thể lưu cấu hình hoàn tiền.'
  ,'creditBenefits.programs': 'Chương trình hoàn tiền'
  ,'creditBenefits.programsDescription': 'Có thể bật đồng thời nhiều chương trình và chủ động tạm ngưng khi cần.'
  ,'creditBenefits.programCount': '{count} chương trình'
  ,'creditBenefits.emptyPrograms': 'Chưa có chương trình'
  ,'creditBenefits.emptyProgramsDescription': 'Thêm chương trình đầu tiên và gom các mã MCC đủ điều kiện.'
  ,'creditBenefits.active': 'Đang bật'
  ,'creditBenefits.inactive': 'Đã tắt'
  ,'creditBenefits.toggleProgram': 'Bật hoặc tắt chương trình'
  ,'creditBenefits.terms': 'Xem điều khoản'
  ,'creditBenefits.maxPerMonth': 'Tối đa {amount} {currency}/tháng'
  ,'creditBenefits.delete': 'Xóa'
  ,'creditBenefits.editProgram': 'Sửa chương trình'
  ,'creditBenefits.programName': 'Tên chương trình'
  ,'creditBenefits.notes': 'Ghi chú / điều kiện'
  ,'creditBenefits.termsUrl': 'Link điều khoản'
  ,'creditBenefits.activeOnSave': 'Bật chương trình sau khi lưu'
  ,'creditBenefits.categoryGroups': 'Nhóm danh mục MCC'
  ,'creditBenefits.categoryGroupsDescription': 'Mỗi MCC chỉ được xuất hiện trong một nhóm của chương trình này.'
  ,'creditBenefits.addGroup': 'Thêm nhóm'
  ,'creditBenefits.groupNumber': 'Nhóm {number}'
  ,'creditBenefits.removeGroup': 'Xóa nhóm'
  ,'creditBenefits.categoryName': 'Tên danh mục'
  ,'creditBenefits.categoryExample': 'Ăn uống, siêu thị, mua sắm online…'
  ,'creditBenefits.cashbackRate': 'Tỷ lệ hoàn tiền'
  ,'creditBenefits.groupCap': 'Tiền hoàn tối đa / tháng'
  ,'creditBenefits.mccCodes': 'Mã MCC'
  ,'creditBenefits.addMcc': 'Thêm MCC'
  ,'creditBenefits.mccHint': 'Nhập một hoặc nhiều MCC bốn chữ số, cách nhau bằng dấu phẩy hoặc khoảng trắng.'
  ,'creditBenefits.removeMcc': 'Xóa MCC {code}'
  ,'creditBenefits.nameRequired': 'Vui lòng nhập tên chương trình.'
  ,'creditBenefits.notesInvalid': 'Ghi chú không được vượt quá 2.000 ký tự.'
  ,'creditBenefits.urlInvalid': 'Link điều khoản phải dùng HTTP hoặc HTTPS.'
  ,'creditBenefits.groupRequired': 'Thêm ít nhất một nhóm MCC.'
  ,'creditBenefits.groupNameRequired': 'Mỗi nhóm cần có tên danh mục.'
  ,'creditBenefits.groupDuplicate': 'Tên danh mục không được trùng trong cùng chương trình.'
  ,'creditBenefits.rateInvalid': 'Tỷ lệ hoàn tiền phải lớn hơn 0 và không vượt quá 100%.'
  ,'creditBenefits.groupCapInvalid': 'Mỗi nhóm cần có trần hoàn tiền lớn hơn 0.'
  ,'creditBenefits.mccRequired': 'Mỗi nhóm cần có ít nhất một MCC.'
  ,'creditBenefits.mccInvalid': 'MCC phải gồm đúng bốn chữ số.'
  ,'creditBenefits.mccDuplicate': 'MCC {code} đã thuộc một nhóm khác trong chương trình.'
  ,'creditBenefits.programSaved': 'Đã lưu chương trình hoàn tiền.'
  ,'creditBenefits.deleteConfirm': 'Xóa “{name}”? Chương trình vẫn được giữ trong lịch sử audit.'
  ,'creditBenefits.programDeleted': 'Đã xóa chương trình hoàn tiền.'
  ,'creditBenefits.deleteFailed': 'Không thể xóa chương trình hoàn tiền.'
  ,'creditBenefits.stale': 'Cấu hình đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu tiếp.'
  ,'route.passwordManager': 'Quản lý mật khẩu'
  ,'shell.passwordManager': 'Quản lý mật khẩu'
  ,'passwordManager.eyebrow': 'BẢO MẬT CÁ NHÂN'
  ,'passwordManager.title': 'Quản lý mật khẩu'
  ,'passwordManager.description': 'Lưu các tài khoản dịch vụ trong kho cá nhân được mã hóa.'
  ,'passwordManager.addModule': 'Thêm module'
  ,'passwordManager.lockNow': 'Khóa ngay'
  ,'passwordManager.search': 'Tìm module hoặc tên account…'
  ,'passwordManager.unlocked': 'Đang mở khóa trong phiên này'
  ,'passwordManager.lockedState': 'Vault đang khóa'
  ,'passwordManager.loading': 'Đang tải password vault…'
  ,'passwordManager.emptyTitle': 'Password vault đang trống'
  ,'passwordManager.emptyDescription': 'Tạo một module dịch vụ, sau đó thêm một hoặc nhiều account.'
  ,'passwordManager.modules': 'Modules'
  ,'passwordManager.accountCount': '{count} account'
  ,'passwordManager.delete': 'Xóa'
  ,'passwordManager.noMatch': 'Không có kết quả phù hợp.'
  ,'passwordManager.service': 'Module dịch vụ'
  ,'passwordManager.addAccount': 'Thêm account'
  ,'passwordManager.emptyAccounts': 'Module này chưa có account.'
  ,'passwordManager.reveal': 'Hiện'
  ,'passwordManager.copyPassword': 'Copy password'
  ,'passwordManager.module': 'Module dịch vụ'
  ,'passwordManager.editModule': 'Sửa module'
  ,'passwordManager.moduleName': 'Tên module'
  ,'passwordManager.website': 'Website'
  ,'passwordManager.descriptionField': 'Mô tả'
  ,'passwordManager.editAccount': 'Sửa account'
  ,'passwordManager.accountName': 'Tên account'
  ,'passwordManager.username': 'Username'
  ,'passwordManager.password': 'Password'
  ,'passwordManager.generator': 'Tạo password mạnh'
  ,'passwordManager.length': 'Độ dài'
  ,'passwordManager.generate': 'Tạo password'
  ,'passwordManager.loginUrl': 'URL đăng nhập'
  ,'passwordManager.note': 'Ghi chú bảo mật'
  ,'passwordManager.encryptedHint': 'Username, password, URL đăng nhập và ghi chú được mã hóa cùng nhau trước khi lưu.'
  ,'passwordManager.securityCheck': 'Kiểm tra bảo mật'
  ,'passwordManager.unlockTitle': 'Mở password vault'
  ,'passwordManager.unlockDescription': 'Xác nhận mật khẩu Kira Life hiện tại. Quyền mở khóa tự hết hạn sau 5 phút.'
  ,'passwordManager.currentPassword': 'Mật khẩu hiện tại'
  ,'passwordManager.unlocking': 'Đang mở khóa…'
  ,'passwordManager.unlock': 'Mở khóa'
  ,'passwordManager.decryptedForSession': 'Đã giải mã cho phiên hiện tại'
  ,'passwordManager.clipboardNote': 'Nội dung đã copy tiếp tục do clipboard của trình duyệt và hệ điều hành quản lý.'
  ,'passwordManager.moduleSaved': 'Đã lưu module.'
  ,'passwordManager.moduleDeleted': 'Đã xóa module và các account bên trong.'
  ,'passwordManager.accountSaved': 'Đã lưu account an toàn.'
  ,'passwordManager.accountDeleted': 'Đã xóa account.'
  ,'passwordManager.deleteModuleConfirm': 'Xóa “{name}” và {count} account bên trong?'
  ,'passwordManager.deleteAccountConfirm': 'Xóa account “{name}”?'
  ,'passwordManager.copied': 'Đã copy vào clipboard.'
  ,'passwordManager.copyFailed': 'Trình duyệt không cho phép truy cập clipboard.'
  ,'passwordManager.locked': 'Password vault đã khóa.'
  ,'passwordManager.actionFailed': 'Không thể hoàn tất thao tác password vault.'
  ,'route.tutorSchedule': 'Lịch dạy gia sư'
  ,'route.favoriteSongs': 'Bài hát karaoke yêu thích'
  ,'route.jobApplications': 'Theo dõi việc làm'
  ,'shell.groupPersonal': 'ĐỜI SỐNG CÁ NHÂN'
  ,'shell.favoriteSongs': 'Bài hát yêu thích'
  ,'shell.jobApplications': 'Theo dõi việc làm'
  ,'resource.flowPersonal': 'ĐỜI SỐNG CÁ NHÂN'
  ,'common.delete': 'Xóa'
  ,'form.addFavoriteSong': 'Thêm bài hát yêu thích'
  ,'form.addFavoriteSongDescription': 'Lưu thông tin cần thiết cho lần đi karaoke tiếp theo.'
  ,'form.editFavoriteSong': 'Sửa bài hát yêu thích'
  ,'form.editFavoriteSongDescription': 'Cập nhật thông tin tham khảo khi hát karaoke.'
  ,'form.addJob': 'Thêm job vào danh sách'
  ,'form.addJobDescription': 'Lưu lại các cơ hội bạn đang cân nhắc để ứng tuyển.'
  ,'form.editJob': 'Sửa thông tin job'
  ,'form.editJobDescription': 'Cập nhật cơ hội, trạng thái ứng tuyển và thông tin liên quan.'
  ,'karaoke.deleteConfirm': 'Xóa bài hát yêu thích này?'
  ,'job.deleteConfirm': 'Xóa job này khỏi danh sách?'
  ,'job.status': 'Trạng thái job'
  ,'job.priority': 'Độ ưu tiên job'
  ,'shell.groupTutor': 'GIA SƯ'
  ,'shell.tutorSchedule': 'Lịch dạy'
  ,'tutor.eyebrow': 'GIA SƯ CÁ NHÂN'
  ,'tutor.title': 'Lịch dạy gia sư'
  ,'tutor.description': 'Sắp xếp lịch lặp hằng tuần, đổi riêng từng buổi và quản lý thông tin học viên.'
  ,'tutor.students': 'Học viên'
  ,'tutor.addLesson': 'Thêm buổi học'
  ,'tutor.previousWeek': 'Tuần trước'
  ,'tutor.nextWeek': 'Tuần sau'
  ,'tutor.today': 'Hôm nay'
  ,'tutor.weekNavigation': 'Chuyển tuần'
  ,'tutor.timezone': 'Giờ Việt Nam'
  ,'tutor.viewMode': 'Chế độ xem lịch'
  ,'tutor.weekView': 'Tuần'
  ,'tutor.agendaView': 'Danh sách'
  ,'tutor.summary': 'Tổng quan lịch dạy'
  ,'tutor.lessonsUnit': 'buổi'
  ,'tutor.focusHoursHint': 'Hiển thị khung giờ quanh các buổi học'
  ,'tutor.fullDayHint': 'Toàn bộ khung giờ · 06:00–23:00'
  ,'tutor.showFullDay': 'Hiện tất cả giờ'
  ,'tutor.retry': 'Tải lại'
  ,'tutor.loading': 'Đang tải lịch dạy…'
  ,'tutor.loadFailed': 'Không thể tải lịch dạy.'
  ,'tutor.pastReadOnly': 'Các tuần trước được giữ nguyên dưới dạng lịch sử chỉ đọc.'
  ,'tutor.lessonCount': 'Số buổi'
  ,'tutor.totalHours': 'Giờ dạy'
  ,'tutor.expectedFee': 'Học phí dự kiến'
  ,'tutor.conflicts': 'Trùng lịch'
  ,'tutor.noStudents': 'Chưa có học viên'
  ,'tutor.noStudentsDescription': 'Thêm học viên đầu tiên trước khi xếp lịch dạy.'
  ,'tutor.addStudent': 'Thêm học viên'
  ,'tutor.cancelled': 'Nghỉ buổi này'
  ,'tutor.movedOnce': 'Đã đổi riêng'
  ,'tutor.add': 'Thêm'
  ,'tutor.noLesson': 'Chưa có buổi học.'
  ,'tutor.online': 'Online'
  ,'tutor.inPerson': 'Trực tiếp'
  ,'tutor.restore': 'Khôi phục'
  ,'tutor.editLesson': 'Sửa buổi học'
  ,'tutor.fromThisWeek': 'Từ tuần này về sau'
  ,'tutor.onlyThisLesson': 'Chỉ buổi này'
  ,'tutor.onceHint': 'Đổi một lần chỉ thay ngày giờ của buổi này. Các thông tin khác được giữ nguyên.'
  ,'tutor.student': 'Học viên'
  ,'tutor.subject': 'Môn học'
  ,'tutor.date': 'Ngày học'
  ,'tutor.start': 'Bắt đầu'
  ,'tutor.end': 'Kết thúc'
  ,'tutor.mode': 'Hình thức'
  ,'tutor.meetingLink': 'Link học online'
  ,'tutor.location': 'Địa điểm'
  ,'tutor.fee': 'Học phí (VND)'
  ,'tutor.note': 'Ghi chú'
  ,'tutor.deleteFuture': 'Kết thúc lịch lặp'
  ,'tutor.cancelOnce': 'Nghỉ buổi này'
  ,'tutor.saving': 'Đang lưu…'
  ,'tutor.directory': 'DANH BẠ HỌC VIÊN'
  ,'tutor.noPhone': 'Chưa có số điện thoại'
  ,'tutor.editStudent': 'Sửa học viên'
  ,'tutor.deleteStudent': 'Lưu trữ học viên'
  ,'tutor.studentName': 'Tên học viên'
  ,'tutor.phone': 'Điện thoại'
  ,'tutor.color': 'Màu trên lịch'
  ,'tutor.timeInvalid': 'Giờ kết thúc phải sau giờ bắt đầu.'
  ,'tutor.cancelOnceConfirm': 'Chỉ nghỉ buổi này? Các tuần sau vẫn giữ nguyên.'
  ,'tutor.deleteFutureConfirm': 'Kết thúc lịch lặp này từ tuần đang xem về sau?'
  ,'tutor.deleteStudentConfirm': 'Lưu trữ học viên này?'
  ,'tutor.applyFutureConfirm': 'Áp dụng ngày giờ mới từ tuần đang xem về sau?'
  ,'tutor.conflictConfirm': 'Lịch mới bị trùng giờ. Bạn vẫn muốn lưu?'
  ,'tutor.dragSameWeek': 'Chỉ kéo buổi học trong tuần đang xem.'
  ,'tutor.studentSaved': 'Đã lưu học viên.'
  ,'tutor.studentDeleted': 'Đã lưu trữ học viên.'
  ,'tutor.saved': 'Đã lưu lịch dạy.'
  ,'tutor.saveFailed': 'Không thể lưu lịch dạy.'
};
