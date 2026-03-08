# Build app cài lên iPhone (internal)

Chỉ dùng **internal distribution**: build để cài trực tiếp lên iPhone đã đăng ký, không đưa lên App Store.

## Yêu cầu (kể cả chỉ cài 1 lần)

- **Tài khoản Expo** (miễn phí): bắt buộc — EAS Build chạy trên server Expo, không thể build mà không đăng nhập. Đăng ký tại [expo.dev](https://expo.dev).
- **Tài khoản Apple Developer** (trả phí ~99 USD/năm): bắt buộc để cài lên **iPhone thật** — Apple yêu cầu ký app và đăng ký thiết bị (internal). Chỉ cài một lần vẫn cần.
- **EAS CLI**: cài một lần trên máy (`npm install -g eas-cli`).

**Nếu không muốn trả phí Apple:** chỉ có thể chạy app trên **máy ảo iPhone** (simulator) trên Mac bằng lệnh `npx expo run:ios` — không cần Apple Developer, nhưng không cài được lên máy thật.

## Các bước

### 1. Cài EAS CLI và đăng nhập

```bash
npm install -g eas-cli
eas login
```

### 2. Build iOS (internal)

```bash
cd mobile-app
eas build --platform ios --profile internal
```

- EAS build trên cloud, trả về link tải file cài (ví dụ `.ipa` hoặc trang cài).
- Lần đầu: EAS hỏi tạo project Expo và liên kết Apple Developer; có thể hướng dẫn đăng ký thiết bị (iPhone) để cài internal.

### 3. Cài lên iPhone

- Vào [expo.dev](https://expo.dev) → project → **Builds** → mở build iOS vừa tạo.
- Tải/ mở link cài hoặc quét QR (nếu có).
- Trên iPhone: bật **Chế độ nhà phát triển** (Cài đặt → Quyền riêng tư & Bảo mật) nếu được yêu cầu.

## Đổi tên app / bundle ID

- **Tên hiển thị:** sửa `expo.name` trong `app.json`.
- **Bundle ID:** sửa `expo.ios.bundleIdentifier` trong `app.json`.

Sau khi đổi, chạy lại: `eas build --platform ios --profile internal`.
