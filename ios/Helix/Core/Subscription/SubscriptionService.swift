/**
 * Subscription Service - Helix iOS
 * Fetches and manages subscription tier from Supabase
 */

import Foundation

@MainActor
final class SubscriptionService: ObservableObject {
    static let shared = SubscriptionService()

    @Published private(set) var subscription: Subscription?
    @Published private(set) var isLoading = false
    @Published private(set) var error: Error?

    private let auth = SupabaseAuthService.shared
    private let supabaseUrl: String
    private let supabaseAnonKey: String

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init(supabaseUrl: String = "", supabaseAnonKey: String = "") {
        // Load from environment or defaults
        self.supabaseUrl = supabaseUrl.isEmpty
            ? Bundle.main.infoDictionary?["SUPABASE_URL"] as? String ?? "https://supabase.com"
            : supabaseUrl
        self.supabaseAnonKey = supabaseAnonKey.isEmpty
            ? Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String ?? ""
            : supabaseAnonKey
    }

    var userTier: SubscriptionTier {
        subscription?.tier ?? .core
    }

    var hasArchitectAccess: Bool {
        userTier.hasAccess(to: .architect)
    }

    var hasOverseerAccess: Bool {
        userTier.hasAccess(to: .overseer)
    }

    var hasPhantomAccess: Bool {
        userTier.hasAccess(to: .phantom)
    }

    func fetchSubscription() async {
        isLoading = true
        defer { isLoading = false }

        guard case .signedIn(let session) = auth.authState else {
            error = NSError(domain: "SubscriptionService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not signed in"])
            return
        }

        do {
            let urlString = "\(supabaseUrl)/rest/v1/subscriptions?user_id=eq.\(session.user.id)"
            guard let url = URL(string: urlString) else {
                throw NSError(domain: "SubscriptionService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            }

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(session.access_token)", forHTTPHeaderField: "Authorization")
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw NSError(domain: "SubscriptionService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
            }

            guard httpResponse.statusCode == 200 else {
                throw NSError(domain: "SubscriptionService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP error"])
            }

            let subscriptions = try decoder.decode([Subscription].self, from: data)
            self.subscription = subscriptions.first

            if subscription == nil {
                // Create default Core tier subscription for new users
                self.subscription = Subscription(
                    id: UUID().uuidString,
                    userId: session.user.id,
                    tier: .core,
                    status: .active,
                    currentPeriodStart: Date(),
                    currentPeriodEnd: Date().addingTimeInterval(365 * 24 * 3600),
                    cancelAtPeriodEnd: false
                )
            }

            error = nil
        } catch {
            self.error = error
            print("[SubscriptionService] Failed to fetch subscription: \(error)")
        }
    }

    func hasAccess(to tier: SubscriptionTier) -> Bool {
        userTier.hasAccess(to: tier)
    }
}
