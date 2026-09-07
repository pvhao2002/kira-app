import Foundation
import Combine

@MainActor
final class CompanionModel: ObservableObject {
    let api = LifeAPI()
    private let health = HealthReader()
    @Published var signedIn = false
    @Published var name = ""
    @Published var origin = ""
    @Published var email = ""
    @Published var password = ""
    @Published var enabled = false
    @Published var busy = false
    @Published var message = ""
    @Published var connection: DeviceConnection?
    private var syncing = false
    private var syncAgain = false
    private var cancellables = Set<AnyCancellable>()
    private var deviceId = ""
    init() {
        api.$session.sink { [weak self] session in
            self?.signedIn = session != nil; self?.name = session?.user.fullName ?? ""
        }.store(in: &cancellables)
        Task { await bootstrap() }
    }
    private func bootstrap() async {
        do {
            if let data = try SecureStorage.read("deviceId"), let value = String(data: data, encoding: .utf8) { deviceId = value }
            else { deviceId = UUID().uuidString.lowercased(); try SecureStorage.write("deviceId", data: Data(deviceId.utf8)) }
            try api.restore(); origin = api.origin
            enabled = signedIn && UserDefaults.standard.bool(forKey: "healthSyncEnabled")
            if enabled { startObservers(); await sync() }
        } catch { message = LifeError(code: "SECURE_STORAGE").localizedDescription }
    }
    func login() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            try await api.login(origin: origin, email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            password = ""; message = ""
            enabled = false; UserDefaults.standard.set(false, forKey: "healthSyncEnabled")
            connection = try await api.connection()
        } catch { show(error) }
    }
    func authorize() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            try await health.authorize()
            message = L.text("Permission request completed. Empty readings do not confirm read access.", "Đã hoàn tất yêu cầu cấp quyền. Dữ liệu rỗng không xác nhận được quyền đọc.")
        } catch { show(error) }
    }
    func setEnabled(_ value: Bool) async {
        guard !busy else { return }
        if !value {
            enabled = false; UserDefaults.standard.set(false, forKey: "healthSyncEnabled"); health.stop(); return
        }
        busy = true
        do {
            try await health.authorize()
            let profile = try await api.profile()
            connection = try await api.connect(deviceId: deviceId, timezone: profile.data.timezone)
            enabled = true; UserDefaults.standard.set(true, forKey: "healthSyncEnabled")
            startObservers(); busy = false; await sync()
        } catch { busy = false; show(error) }
    }
    private func startObservers() { health.observe { [weak self] in await self?.sync() } }
    func sync() async {
        guard enabled, signedIn else { return }
        if syncing { syncAgain = true; return }
        guard !busy else { return }
        syncing = true; busy = true
        defer {
            syncing = false; busy = false
            if syncAgain { syncAgain = false; Task { await sync() } }
        }
        do {
            guard var current = try await api.connection(), current.deviceId == deviceId,
                  let user = api.session?.user.id else { throw LifeError(code: "HEALTH_DEVICE_DISCONNECTED") }
            let account = api.origin + ":" + String(user)
            let cal = try health.calendar(current.timezone)
            var state = try SyncStorage.load()
            if state?.account != account || state?.generation != current.generation || state?.timezone != current.timezone {
                let start = cal.date(byAdding: .day, value: -29, to: cal.startOfDay(for: Date()))!
                state = SyncState(account: account, generation: current.generation, timezone: current.timezone, initialStart: start,
                    dirtyDates: Set(health.dates(from: start, through: Date(), calendar: cal)))
            }
            guard let savedState = state else { throw LifeError(code: "SECURE_STORAGE") }
            var next = try await health.collectChanges(savedState)
            // Anchors, deletion mappings and pending dates commit together BEFORE upload.
            try SyncStorage.save(next)
            let dates = next.dirtyDates.sorted()
            for offset in stride(from: 0, to: dates.count, by: 31) {
                let chunk = Array(dates[offset..<min(offset + 31, dates.count)])
                var days: [DayPayload] = []
                for date in chunk { days.append(try await health.snapshot(date, timezone: next.timezone)) }
                let payload = SyncPayload(deviceId: deviceId, generation: current.generation, revision: current.lastRevision + 1, timezone: current.timezone, days: days)
                current = try await api.sync(payload)
                next.dirtyDates.subtract(chunk); try SyncStorage.save(next)
            }
            connection = current
            message = L.text("Sync completed. Missing readings remain unknown; background updates depend on iOS.", "Đã đồng bộ. Chỉ số chưa có vẫn để trống; cập nhật nền phụ thuộc iOS.")
        } catch {
            if let error = error as? LifeError, error.code == "HEALTH_DEVICE_DISCONNECTED" {
                enabled = false; UserDefaults.standard.set(false, forKey: "healthSyncEnabled"); health.stop(); connection = nil
            }
            show(error)
        }
    }
    func disconnect() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            try await api.disconnect(); enabled = false; health.stop()
            UserDefaults.standard.set(false, forKey: "healthSyncEnabled"); try SyncStorage.clear(); connection = nil
            message = L.text("Disconnected. Existing server data is retained.", "Đã ngắt kết nối. Dữ liệu đã gửi vẫn được giữ trên máy chủ.")
        } catch { show(error) }
    }
    func logout() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            try await api.logout(); enabled = false; health.stop()
            UserDefaults.standard.set(false, forKey: "healthSyncEnabled"); try SyncStorage.clear(); connection = nil; message = ""
        } catch { show(error) }
    }
    private func show(_ error: Error) {
        message = (error as? LifeError)?.localizedDescription ?? LifeError(code: "NETWORK").localizedDescription
    }
}
