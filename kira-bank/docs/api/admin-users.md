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

`status` là `ACTIVE` hoặc `LOCKED`, giá trị khác trả 400. Tài khoản LOCKED không đăng nhập hay refresh được, và access token đang dùng bị từ chối ngay (bộ lọc JWT chỉ nhận ACTIVE). Không được khóa chính mình (400 CANNOT_CHANGE_OWN_STATUS) hay tài khoản Admin (400 CANNOT_CHANGE_ADMIN_STATUS). User không tồn tại trả 404 USER_NOT_FOUND. Thành công trả AdminUserResponse.

Màn hình `/app/admin/users` hỗ trợ xem danh sách, tạo, khóa và mở khóa User. Chưa hỗ trợ sửa, xóa hoặc đặt lại mật khẩu.
