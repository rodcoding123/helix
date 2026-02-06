/**
 * Instance Service - Helix iOS
 * Manages instance creation and fetching from Supabase
 */

import Foundation

struct Instance: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let instanceKey: String
    let isActive: Bool
    let createdAt: Date
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, userId, name, instanceKey, isActive
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

@MainActor
actor InstanceService {
    static let shared = InstanceService()

    private let supabaseUrl: String
    private let backendProxyUrl: String
    private let auth = SupabaseAuthService.shared

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init(supabaseUrl: String = "", backendProxyUrl: String = "") {
        self.supabaseUrl = supabaseUrl.isEmpty
            ? Bundle.main.infoDictionary?["SUPABASE_URL"] as? String ?? "https://supabase.com"
            : supabaseUrl
        self.backendProxyUrl = backendProxyUrl.isEmpty
            ? Bundle.main.infoDictionary?["BACKEND_PROXY_URL"] as? String ?? "\(supabaseUrl)/functions/v1/mobile-instance-api"
            : backendProxyUrl
    }

    func createInstance(name: String, instanceKey: String) async throws -> Instance {
        guard case .signedIn(let session) = auth.authState else {
            throw NSError(domain: "InstanceService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not signed in"])
        }

        // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
        guard let url = URL(string: backendProxyUrl) else {
            throw NSError(domain: "InstanceService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        let body: [String: AnyCodable] = [
            "name": .string(name),
            "instance_key": .string(instanceKey)
        ]

        let bodyData = try JSONSerialization.data(withJSONObject: body.mapValues { value -> Any in
            switch value {
            case .string(let s):
                return s
            case .int(let i):
                return i
            case .bool(let b):
                return b
            default:
                return NSNull()
            }
        })

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.access_token)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "InstanceService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 201 else {
            throw NSError(domain: "InstanceService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])
        }

        let instance = try decoder.decode(Instance.self, from: data)
        return instance
    }

    func fetchInstances() async throws -> [Instance] {
        guard case .signedIn(let session) = auth.authState else {
            throw NSError(domain: "InstanceService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not signed in"])
        }

        // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
        let urlString = "\(backendProxyUrl)?user_id=\(session.user.id)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "InstanceService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.access_token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "InstanceService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 200 else {
            throw NSError(domain: "InstanceService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])
        }

        let instances = try decoder.decode([Instance].self, from: data)
        return instances
    }

    func deleteInstance(id: String) async throws {
        guard case .signedIn(let session) = auth.authState else {
            throw NSError(domain: "InstanceService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not signed in"])
        }

        // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
        let urlString = "\(backendProxyUrl)?id=\(id)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "InstanceService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.access_token)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "InstanceService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 200 else {
            throw NSError(domain: "InstanceService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])
        }
    }
}
