import Foundation

struct LifeUser: Codable { let id: Int64; let fullName: String }
struct LifeSession: Codable {
    let accessToken: String
    let expiresInSeconds: Int
    let user: LifeUser
    let refreshToken: String
}
struct StoredSession: Codable { let origin: String; let session: LifeSession }
struct HealthProfileEnvelope: Decodable { let data: ProfileTimezone }
struct ProfileTimezone: Decodable { let timezone: String }
struct DeviceConnection: Codable {
    let deviceId: String
    let generation: String
    let timezone: String
    let lastRevision: Int64
    let lastSyncedAt: String?
}
struct WorkoutPayload: Codable {
    let id: String
    let start: String
    let end: String
    let type: String
    let calories: Double?
    let source: String
}
struct DayPayload: Codable {
    let date: String
    let activeCalories: Double?
    let restingCalories: Double?
    let steps: Int64?
    let workouts: [WorkoutPayload]
    let source = "APPLE_HEALTH"
}
struct SyncPayload: Encodable {
    let deviceId: String
    let generation: String
    let revision: Int64
    let timezone: String
    let days: [DayPayload]
}
struct SyncState: Codable {
    let account: String
    let generation: String
    let timezone: String
    let initialStart: Date
    var anchors: [String: Data] = [:]
    var sampleDates: [String: [String]] = [:]
    var dirtyDates: Set<String> = []
}
struct LifeError: LocalizedError {
    let code: String
    var errorDescription: String? {
        switch code {
        case "HEALTH_PROFILE_REQUIRED": return L.text("Create your health profile on the web first.", "Hãy tạo hồ sơ sức khỏe trên web trước.")
        case "HEALTH_DEVICE_ALREADY_CONNECTED": return L.text("Disconnect the previous iPhone on the web first.", "Hãy ngắt kết nối iPhone trước trên web.")
        case "HEALTH_DEVICE_DISCONNECTED": return L.text("This connection was removed. Connect again to resume.", "Kết nối đã bị gỡ. Hãy kết nối lại để tiếp tục.")
        case "UNAUTHORIZED", "BAD_CREDENTIALS", "INVALID_REFRESH_TOKEN": return L.text("Sign in again. Check your email and password.", "Hãy đăng nhập lại và kiểm tra email, mật khẩu.")
        case "HTTPS_REQUIRED": return L.text("Enter the HTTPS address of your Kira Life server.", "Nhập địa chỉ HTTPS của máy chủ Kira Life.")
        case "HEALTH_UNAVAILABLE": return L.text("Health data is unavailable on this device.", "Thiết bị này không hỗ trợ dữ liệu sức khỏe.")
        case "SECURE_STORAGE": return L.text("Secure storage is unavailable. Unlock the iPhone and try again.", "Chưa thể truy cập bộ nhớ bảo mật. Mở khóa iPhone và thử lại.")
        default: return L.text("Could not complete the action. Check the connection and try again; pending sync data is retained.", "Chưa thể hoàn tất. Kiểm tra kết nối và thử lại; tiến độ đồng bộ đang chờ được giữ lại.")
        }
    }
}
enum L {
    static func text(_ en: String, _ vi: String) -> String { Locale.current.language.languageCode?.identifier == "vi" ? vi : en }
}
