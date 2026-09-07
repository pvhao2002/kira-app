import SwiftUI

@main
@MainActor
struct KiraLifeApp: App {
    @StateObject private var model = CompanionModel()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                Form {
                    Section {
                        Label("Kira Life", systemImage: "heart.circle.fill")
                            .font(.largeTitle.bold()).foregroundStyle(.mint)
                        Text(L.text("Your private Apple Health companion", "Kết nối Apple Health của riêng bạn"))
                            .foregroundStyle(.secondary)
                    }
                    if model.signedIn {
                        Section(L.text("Account", "Tài khoản")) {
                            Text(model.name)
                            Text(model.origin).font(.caption).foregroundStyle(.secondary)
                        }
                        Section(L.text("Apple Health", "Apple Health")) {
                            Text(L.text("Reads active energy, resting energy, steps and workouts. Your height and weight are managed on the web.",
                                "Đọc năng lượng vận động, năng lượng nghỉ, bước chân và buổi tập. Chiều cao và cân nặng được quản lý trên web."))
                            Button(L.text("Review Health permissions", "Xem quyền truy cập sức khỏe")) { Task { await model.authorize() } }
                            Toggle(L.text("Enable sync", "Bật đồng bộ"), isOn: Binding(get: { model.enabled }, set: { value in Task { await model.setEnabled(value) } }))
                            Button(L.text("Sync now", "Đồng bộ ngay")) { Task { await model.sync() } }.disabled(!model.enabled)
                            if let connection = model.connection {
                                LabeledContent(L.text("Timezone", "Múi giờ"), value: connection.timezone)
                                LabeledContent(L.text("Last successful sync", "Đồng bộ thành công gần nhất"), value: connection.lastSyncedAt ?? "—")
                            }
                        }
                        Section {
                            Text(L.text("The first sync covers 30 days. iOS controls background delivery. No readings may mean no data or unavailable read access, never a confirmed denial.",
                                "Lần đầu lấy 30 ngày. iOS quyết định cập nhật nền. Kết quả trống có thể do chưa có dữ liệu hoặc chưa có quyền đọc; app không xác nhận được việc từ chối quyền."))
                                .font(.footnote).foregroundStyle(.secondary)
                            Text(L.text("Health data is sent only to your Kira Life server. AI sharing is a separate choice on the web. You can disconnect and delete synced data there.",
                                "Dữ liệu sức khỏe chỉ gửi tới máy chủ Kira Life của bạn. Chia sẻ với AI được chọn riêng trên web. Bạn có thể ngắt kết nối và xóa dữ liệu đã đồng bộ tại đó."))
                                .font(.footnote).foregroundStyle(.secondary)
                            Button(L.text("Disconnect iPhone", "Ngắt kết nối iPhone"), role: .destructive) { Task { await model.disconnect() } }
                            Button(L.text("Sign out", "Đăng xuất")) { Task { await model.logout() } }
                        }
                    } else {
                        Section(L.text("Sign in to Kira Life", "Đăng nhập Kira Life")) {
                            TextField("https://…", text: $model.origin).textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                            TextField("Email", text: $model.email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                            SecureField(L.text("Password", "Mật khẩu"), text: $model.password).textContentType(.password)
                            Button(L.text("Sign in", "Đăng nhập")) { Task { await model.login() } }
                                .disabled(model.email.isEmpty || model.password.isEmpty || model.origin.isEmpty)
                        }
                    }
                    if model.busy { ProgressView(L.text("Working…", "Đang xử lý…")) }
                    if !model.message.isEmpty { Section { Text(model.message).accessibilityAddTraits(.updatesFrequently) } }
                }
                .disabled(model.busy).navigationTitle("Kira Life").navigationBarTitleDisplayMode(.inline)
            }
            .tint(.mint)
        }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await model.sync() } } }
    }
}
