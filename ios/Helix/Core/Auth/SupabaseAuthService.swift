/**
 * Supabase Authentication Service - Helix iOS
 * Handles user authentication with Supabase Auth API
 * Supports email/password sign-in, sign-up, token refresh, and session management
 */

import Foundation
import Security

// MARK: - Data Models

struct AuthUser: Codable {
    let id: String
    let email: String?
    let phone: String?
    let created_at: String
    let updated_at: String?
    let email_confirmed_at: String?
    let phone_confirmed_at: String?
    let app_metadata: [String: String]?
    let user_metadata: [String: String]?
}

struct AuthSession: Codable {
    let access_token: String
    let refresh_token: String
    let expires_in: Int
    let expires_at: Int?
    let token_type: String
    let user: AuthUser

    var expiresAtTimestamp: Int {
        expires_at ?? (Int(Date().timeIntervalSince1970) + expires_in)
    }

    var isExpired: Bool {
        let now = Int(Date().timeIntervalSince1970)
        return expiresAtTimestamp < now + 60 // Consider expired if less than 60 seconds remaining
    }

    var isExpiringSoon: Bool {
        let now = Int(Date().timeIntervalSince1970)
        return expiresAtTimestamp < now + 300 // Expiring within 5 minutes
    }
}

struct AuthResponse: Codable {
    let access_token: String?
    let refresh_token: String?
    let expires_in: Int?
    let expires_at: Int?
    let token_type: String?
    let user: AuthUser?
    let error: String?
    let error_description: String?
}

// MARK: - Auth State

enum AuthState: Equatable {
    case unknown
    case loading
    case signedOut
    case signedIn(session: AuthSession)
    case error(message: String)

    static func == (lhs: AuthState, rhs: AuthState) -> Bool {
        switch (lhs, rhs) {
        case (.unknown, .unknown): return true
        case (.loading, .loading): return true
        case (.signedOut, .signedOut): return true
        case (.signedIn(let a), .signedIn(let b)): return a.access_token == b.access_token
        case (.error(let a), .error(let b)): return a == b
        default: return false
        }
    }
}

enum AuthResult<T> {
    case success(T)
    case error(String, Int?)
}

// MARK: - Auth Service

@MainActor
class SupabaseAuthService: ObservableObject {
    static let shared = SupabaseAuthService()

    @Published private(set) var authState: AuthState = .unknown

    private let supabaseUrl: String
    private let supabaseAnonKey: String
    private let keychain = KeychainHelper()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()

    private init() {
        // Load from environment or config
        self.supabaseUrl = ProcessInfo.processInfo.environment["SUPABASE_URL"]
            ?? Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String
            ?? ""
        self.supabaseAnonKey = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String
            ?? ""
    }

    private var authUrl: String {
        "\(supabaseUrl)/auth/v1"
    }

    // MARK: - Public API

    /// Initialize auth state from stored session
    func initialize() async {
        authState = .loading

        if let session = loadSession() {
            if !session.isExpired {
                authState = .signedIn(session: session)
            } else {
                // Try to refresh
                let result = await refreshToken(session.refresh_token)
                switch result {
                case .success(let newSession):
                    authState = .signedIn(session: newSession)
                case .error:
                    clearSession()
                    authState = .signedOut
                }
            }
        } else {
            authState = .signedOut
        }
    }

    /// Sign in with email and password
    func signIn(email: String, password: String) async -> AuthResult<AuthSession> {
        authState = .loading

        let body: [String: Any] = [
            "email": email,
            "password": password
        ]

        guard let url = URL(string: "\(authUrl)/token?grant_type=password") else {
            authState = .error(message: "Invalid URL")
            return .error("Invalid URL", nil)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            authState = .error(message: "Failed to encode request")
            return .error("Failed to encode request", nil)
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                authState = .error(message: "Invalid response")
                return .error("Invalid response", nil)
            }

            if httpResponse.statusCode != 200 {
                let errorResponse = try? JSONDecoder().decode(AuthResponse.self, from: data)
                let message = errorResponse?.error_description ?? errorResponse?.error ?? "Sign in failed"
                authState = .error(message: message)
                return .error(message, httpResponse.statusCode)
            }

            let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)

            guard let accessToken = authResponse.access_token,
                  let refreshToken = authResponse.refresh_token,
                  let user = authResponse.user else {
                authState = .error(message: "Invalid response data")
                return .error("Invalid response data", nil)
            }

            let session = AuthSession(
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: authResponse.expires_in ?? 3600,
                expires_at: authResponse.expires_at,
                token_type: authResponse.token_type ?? "bearer",
                user: user
            )

            saveSession(session)
            authState = .signedIn(session: session)
            return .success(session)

        } catch {
            let message = "Network error: \(error.localizedDescription)"
            authState = .error(message: message)
            return .error(message, nil)
        }
    }

    /// Sign up with email and password
    func signUp(email: String, password: String, metadata: [String: String]? = nil) async -> AuthResult<AuthSession> {
        authState = .loading

        var body: [String: Any] = [
            "email": email,
            "password": password
        ]
        if let metadata = metadata {
            body["data"] = metadata
        }

        guard let url = URL(string: "\(authUrl)/signup") else {
            authState = .error(message: "Invalid URL")
            return .error("Invalid URL", nil)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            authState = .error(message: "Failed to encode request")
            return .error("Failed to encode request", nil)
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                authState = .error(message: "Invalid response")
                return .error("Invalid response", nil)
            }

            if httpResponse.statusCode != 200 && httpResponse.statusCode != 201 {
                let errorResponse = try? JSONDecoder().decode(AuthResponse.self, from: data)
                let message = errorResponse?.error_description ?? errorResponse?.error ?? "Sign up failed"
                authState = .error(message: message)
                return .error(message, httpResponse.statusCode)
            }

            let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)

            // Some Supabase configs require email confirmation
            guard let accessToken = authResponse.access_token else {
                authState = .signedOut
                return .error("Please check your email to confirm your account", nil)
            }

            guard let refreshToken = authResponse.refresh_token,
                  let user = authResponse.user else {
                authState = .error(message: "Invalid response data")
                return .error("Invalid response data", nil)
            }

            let session = AuthSession(
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: authResponse.expires_in ?? 3600,
                expires_at: authResponse.expires_at,
                token_type: authResponse.token_type ?? "bearer",
                user: user
            )

            saveSession(session)
            authState = .signedIn(session: session)
            return .success(session)

        } catch {
            let message = "Network error: \(error.localizedDescription)"
            authState = .error(message: message)
            return .error(message, nil)
        }
    }

    /// Sign out the current user
    func signOut() async -> AuthResult<Void> {
        if case .signedIn(let session) = authState {
            guard let url = URL(string: "\(authUrl)/logout") else {
                clearSession()
                authState = .signedOut
                return .success(())
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(session.access_token)", forHTTPHeaderField: "Authorization")

            // Fire and forget - sign out locally regardless of server response
            _ = try? await URLSession.shared.data(for: request)
        }

        clearSession()
        authState = .signedOut
        return .success(())
    }

    /// Refresh the access token
    func refreshToken(_ refreshToken: String? = nil) async -> AuthResult<AuthSession> {
        let token: String
        if let providedToken = refreshToken {
            token = providedToken
        } else if case .signedIn(let session) = authState {
            token = session.refresh_token
        } else {
            return .error("No refresh token available", nil)
        }

        let body: [String: Any] = ["refresh_token": token]

        guard let url = URL(string: "\(authUrl)/token?grant_type=refresh_token") else {
            return .error("Invalid URL", nil)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            return .error("Failed to encode request", nil)
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                return .error("Invalid response", nil)
            }

            if httpResponse.statusCode != 200 {
                let errorResponse = try? JSONDecoder().decode(AuthResponse.self, from: data)
                let message = errorResponse?.error_description ?? errorResponse?.error ?? "Token refresh failed"
                return .error(message, httpResponse.statusCode)
            }

            let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)

            guard let accessToken = authResponse.access_token else {
                return .error("No access token in response", nil)
            }

            // Get existing user if not in response
            let user: AuthUser
            if let responseUser = authResponse.user {
                user = responseUser
            } else if case .signedIn(let existingSession) = authState {
                user = existingSession.user
            } else {
                return .error("No user data", nil)
            }

            let session = AuthSession(
                access_token: accessToken,
                refresh_token: authResponse.refresh_token ?? token, // Some providers don't rotate
                expires_in: authResponse.expires_in ?? 3600,
                expires_at: authResponse.expires_at,
                token_type: authResponse.token_type ?? "bearer",
                user: user
            )

            saveSession(session)
            authState = .signedIn(session: session)
            return .success(session)

        } catch {
            return .error("Network error: \(error.localizedDescription)", nil)
        }
    }

    /// Get current access token (for API calls)
    /// Automatically refreshes if expiring soon
    func getAccessToken() async -> String? {
        guard case .signedIn(let session) = authState else {
            return nil
        }

        if session.isExpiringSoon {
            let result = await refreshToken()
            switch result {
            case .success(let newSession):
                return newSession.access_token
            case .error:
                return nil
            }
        }

        return session.access_token
    }

    /// Get current user
    func getCurrentUser() -> AuthUser? {
        if case .signedIn(let session) = authState {
            return session.user
        }
        return nil
    }

    // MARK: - Session Storage (Keychain)

    private func saveSession(_ session: AuthSession) {
        do {
            let data = try encoder.encode(session)
            keychain.save(data, forKey: "helix_auth_session")
        } catch {
            print("Failed to save session: \(error)")
        }
    }

    private func loadSession() -> AuthSession? {
        guard let data = keychain.load(forKey: "helix_auth_session") else {
            return nil
        }

        do {
            return try decoder.decode(AuthSession.self, from: data)
        } catch {
            print("Failed to load session: \(error)")
            return nil
        }
    }

    private func clearSession() {
        keychain.delete(forKey: "helix_auth_session")
    }
}

// MARK: - Keychain Helper

private class KeychainHelper {
    func save(_ data: Data, forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func load(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)

        guard status == errSecSuccess else {
            return nil
        }

        return dataTypeRef as? Data
    }

    func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
