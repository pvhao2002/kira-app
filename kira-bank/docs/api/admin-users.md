# Quản lý User

Các API dưới đây yêu cầu đăng nhập với `ROLE_ADMIN`. User thường không được truy cập.

## Danh sách

`GET /api/v1/admin/users?search=&page=0&size=20`

Tìm theo tên hoặc email (không phân biệt hoa thường); page bắt đầu từ 0, size từ 1 đến 100. Sắp xếp createdAt giảm dần, sau đó id giảm dần; loại tài khoản đã xóa mềm.

Trả `{data, meta: {page, size, totalElements, totalPages}}`. Mỗi dòng gồm `id`, `fullName`, `email`, `phone`, `roles`, `status`; không trả mật khẩu hay token.

## Tạo User

`POST /api/v1/admin/users`

```json
{"email":"user@example.com","fullName":"New User","phone":null,"password":"example-password"}
```

Họ tên bắt buộc, tối đa 150 ký tự; email hợp lệ và duy nhất; điện thoại tùy chọn, tối đa 30 ký tự; mật khẩu 8–72 ký tự. Email được trim và chuyển chữ thường; mật khẩu được mã hóa theo cơ chế hiện có.

Tài khoản mới luôn ACTIVE và chỉ có ROLE_USER. Trường roles vẫn được chấp nhận nếu null, rỗng hoặc chỉ chứa ROLE_USER; quyền khác trả 400 INVALID_USER_ROLES. Email trùng trả 409 EMAIL_EXISTS. Tạo thành công trả 201 và ProfileResponse, không tạo phiên đăng nhập mới cho Admin.

## Khóa / mở khóa User

`PATCH /api/v1/admin/users/{id}/status`

```json
{"status":"LOCKED"}
```

`status` là `ACTIVE` hoặc `LOCKED`, giá trị khác trả 400. Tài khoản LOCKED không đăng nhập hay refresh được, và access token đang dùng bị từ chối ngay (bộ lọc JWT chỉ nhận ACTIVE). Không được khóa chính mình (400 CANNOT_CHANGE_OWN_STATUS); có thể khóa Admin khác. User không tồn tại trả 404 USER_NOT_FOUND. Thành công trả AdminUserResponse.

## Xóa User

`DELETE /api/v1/admin/users/{id}`

Xóa mềm (đặt deletedAt) và thu hồi mọi refresh token của User; trả 204. Không được xóa chính mình (400 CANNOT_DELETE_SELF). User không tồn tại hoặc đã xóa trả 404 USER_NOT_FOUND.

Màn hình `/app/admin/users` hỗ trợ xem danh sách, tạo, khóa, mở khóa và xóa User. Chưa hỗ trợ sửa hoặc đặt lại mật khẩu.

## Hạn mức sử dụng (User thường; Admin được miễn)

- Upload: tối đa 500 MB tích lũy mỗi User (`users.uploaded_bytes`); vượt trả 413 UPLOAD_QUOTA_EXCEEDED.
- AI: tối đa 100 lượt mỗi ngày (múi giờ Asia/Ho_Chi_Minh, bảng `user_ai_usage`); vượt trả 429 AI_DAILY_LIMIT_EXCEEDED kèm header `Retry-After` (giây đến 00:00).
