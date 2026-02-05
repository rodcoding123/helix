/**
 * Intelligence Settings API Service - Phase 8 iOS
 * Handles communication with the Supabase intelligence-settings Edge Function
 */

import Foundation

// MARK: - API Response Types

struct OperationSettingResponse: Codable {
    let operation_id: String
    let operation_name: String
    let description: String?
    let primary_model: String
    let fallback_model: String?
    let cost_criticality: String
    let estimated_cost_usd: Double
    let enabled: Bool
}

struct BudgetSettingResponse: Codable {
    let daily_limit_usd: Double
    let monthly_limit_usd: Double
    let warning_threshold: Int
}

struct UsageStatsResponse: Codable {
    let daily_usd: Double
    let monthly_usd: Double
    let daily_operations: Int
    let monthly_operations: Int
    let budget_status: String
}

struct IntelligenceSettingsResponse: Codable {
    let operations: [OperationSettingResponse]
    let budget: BudgetSettingResponse
    let usage: UsageStatsResponse
}

// MARK: - API Request Types

struct OperationSettingSaveRequest: Codable {
    let operation_id: String
    let enabled: Bool
}

struct BudgetSettingSaveRequest: Codable {
    let daily_limit_usd: Double
    let monthly_limit_usd: Double
    let warning_threshold: Int
}

struct IntelligenceSettingsSaveRequest: Codable {
    let operations: [OperationSettingSaveRequest]
    let budget: BudgetSettingSaveRequest
}

struct SaveResponse: Codable {
    let success: Bool
}

// MARK: - API Result

enum ApiResult<T> {
    case success(T)
    case error(String, Int?)
}

// MARK: - Service

actor IntelligenceSettingsService {
    static let shared = IntelligenceSettingsService()

    private let supabaseUrl: String
    private var authTokenProvider: (() async -> String?)?

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
    }

    func configure(authTokenProvider: @escaping () async -> String?) {
        self.authTokenProvider = authTokenProvider
    }

    /// Configure with SupabaseAuthService for automatic token management
    @MainActor
    func configureWithAuth() {
        self.authTokenProvider = {
            await SupabaseAuthService.shared.getAccessToken()
        }
    }

    private var baseURL: URL? {
        URL(string: "\(supabaseUrl)/functions/v1/intelligence-settings")
    }

    // MARK: - Fetch Settings

    func fetchSettings() async -> ApiResult<IntelligenceSettingsResponse> {
        guard let url = baseURL else {
            return .error("Invalid URL configuration", nil)
        }

        guard let provider = authTokenProvider,
              let token = await provider() else {
            return .error("Not authenticated", 401)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                return .error("Invalid response", nil)
            }

            guard httpResponse.statusCode == 200 else {
                let message = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                return .error(message, httpResponse.statusCode)
            }

            let settings = try JSONDecoder().decode(IntelligenceSettingsResponse.self, from: data)
            return .success(settings)

        } catch let error as DecodingError {
            return .error("Failed to parse response: \(error.localizedDescription)", nil)
        } catch {
            return .error("Network error: \(error.localizedDescription)", nil)
        }
    }

    // MARK: - Save Settings

    func saveSettings(
        operations: [OperationSettingSaveRequest],
        budget: BudgetSettingSaveRequest
    ) async -> ApiResult<SaveResponse> {
        guard let url = baseURL else {
            return .error("Invalid URL configuration", nil)
        }

        guard let provider = authTokenProvider,
              let token = await provider() else {
            return .error("Not authenticated", 401)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        let requestBody = IntelligenceSettingsSaveRequest(
            operations: operations,
            budget: budget
        )

        do {
            request.httpBody = try encoder.encode(requestBody)

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                return .error("Invalid response", nil)
            }

            guard httpResponse.statusCode == 200 else {
                let message = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                return .error(message, httpResponse.statusCode)
            }

            let result = try decoder.decode(SaveResponse.self, from: data)
            return .success(result)

        } catch let error as EncodingError {
            return .error("Failed to encode request: \(error.localizedDescription)", nil)
        } catch let error as DecodingError {
            return .error("Failed to parse response: \(error.localizedDescription)", nil)
        } catch {
            return .error("Network error: \(error.localizedDescription)", nil)
        }
    }
}
