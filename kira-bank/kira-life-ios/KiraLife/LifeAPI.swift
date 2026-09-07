import Foundation
import Combine

private final class SameOriginRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        guard let original = task.originalRequest?.url, let target = request.url,
              original.scheme == target.scheme, original.host == target.host, original.port == target.port else {
            completionHandler(nil); return
        }
        completionHandler(request)
    }
}

@MainActor
final class LifeAPI: ObservableObject {
    @Published private(set) var session: LifeSession?
    @Published private(set) var origin = ""
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let transport: URLSession
    init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.timeoutIntervalForRequest = 60
        config.urlCache = nil
        transport = URLSession(configuration: config, delegate: SameOriginRedirects(), delegateQueue: nil)
    }
    func restore() throws {
        if let data = try SecureStorage.read("session") {
            let saved = try decoder.decode(StoredSession.self, from: data)
            origin = saved.origin; session = saved.session
        }
    }
    private func accept(_ value: LifeSession) throws {
        try SecureStorage.write("session", data: encoder.encode(StoredSession(origin: origin, session: value)))
        session = value
    }
    func login(origin input: String, email: String, password: String) async throws {
        guard let url = URL(string: input.trimmingCharacters(in: .whitespacesAndNewlines)), url.scheme == "https",
              url.host != nil, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { throw LifeError(code: "HTTPS_REQUIRED") }
        origin = url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let data = try await send("POST", "/api/v1/auth/mobile/login", body: encoder.encode(["email": email, "password": password]), authenticated: false)
        try accept(decoder.decode(LifeSession.self, from: data))
    }
    private func send(_ method: String, _ path: String, body: Data? = nil, authenticated: Bool = true, retry: Bool = true) async throws -> Data {
        guard let url = URL(string: origin + path) else { throw LifeError(code: "HTTPS_REQUIRED") }
        var request = URLRequest(url: url); request.httpMethod = method; request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authenticated {
            guard let token = session?.accessToken else { throw LifeError(code: "UNAUTHORIZED") }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw LifeError(code: "NETWORK") }
        if http.statusCode == 401 && authenticated && retry {
            guard let refresh = session?.refreshToken else { throw LifeError(code: "UNAUTHORIZED") }
            do {
                let rotated = try await send("POST", "/api/v1/auth/mobile/refresh", body: encoder.encode(["refreshToken": refresh]), authenticated: false, retry: false)
                try accept(decoder.decode(LifeSession.self, from: rotated))
            } catch let error as LifeError {
                if ["INVALID_REFRESH_TOKEN", "UNAUTHORIZED", "BAD_CREDENTIALS"].contains(error.code) { clearSession() }
                throw error
            }
            return try await send(method, path, body: body, retry: false)
        }
        guard (200..<300).contains(http.statusCode) else {
            struct ErrorBody: Decodable { let code: String }
            let code = (try? decoder.decode(ErrorBody.self, from: data).code) ?? (http.statusCode == 401 ? "UNAUTHORIZED" : "NETWORK")
            throw LifeError(code: code)
        }
        return data
    }
    func profile() async throws -> HealthProfileEnvelope {
        let data = try await send("GET", "/api/v1/health/profile")
        guard !data.isEmpty, String(data: data, encoding: .utf8) != "null" else { throw LifeError(code: "HEALTH_PROFILE_REQUIRED") }
        return try decoder.decode(HealthProfileEnvelope.self, from: data)
    }
    func connection() async throws -> DeviceConnection? {
        let data = try await send("GET", "/api/v1/health/connection")
        if data.isEmpty || String(data: data, encoding: .utf8) == "null" { return nil }
        return try decoder.decode(DeviceConnection.self, from: data)
    }
    func connect(deviceId: String, timezone: String) async throws -> DeviceConnection {
        let data = try await send("POST", "/api/v1/health/connection", body: encoder.encode(["deviceId": deviceId, "timezone": timezone]))
        return try decoder.decode(DeviceConnection.self, from: data)
    }
    func sync(_ payload: SyncPayload) async throws -> DeviceConnection {
        let data = try await send("POST", "/api/v1/health/sync", body: encoder.encode(payload))
        return try decoder.decode(DeviceConnection.self, from: data)
    }
    func disconnect() async throws { _ = try await send("DELETE", "/api/v1/health/connection?deleteData=false") }
    func logout() async throws {
        if let refresh = session?.refreshToken {
            _ = try await send("POST", "/api/v1/auth/mobile/logout", body: encoder.encode(["refreshToken": refresh]), authenticated: false)
        }
        clearSession()
    }
    private func clearSession() { SecureStorage.remove("session"); session = nil }
}
