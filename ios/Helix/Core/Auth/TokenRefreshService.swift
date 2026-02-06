/**
 * Token Refresh Service - Automatic JWT refresh
 * HIGH FIX 3.1: Automatically refresh JWT tokens when they expire
 * Prevents authentication failures due to expired tokens
 */

import Foundation

@MainActor
actor TokenRefreshService {
    static let shared = TokenRefreshService()

    private let auth = SupabaseAuthService.shared
    private var refreshTimer: Timer?
    private var lastRefreshTime: Date?

    private let minRefreshInterval: TimeInterval = 60  // Don't refresh more than once per minute
    private let refreshBeforeExpiry: TimeInterval = 5 * 60  // Refresh 5 minutes before expiry

    /**
     * Start automatic token refresh monitoring
     * Should be called when app launches or user logs in
     */
    func startMonitoring() {
        stopMonitoring()  // Stop any existing timer

        // Check every 30 seconds if token needs refresh
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task {
                await self?.checkAndRefreshToken()
            }
        }
    }

    /**
     * Stop automatic token refresh monitoring
     */
    func stopMonitoring() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    /**
     * Check if token needs refresh and refresh if necessary
     */
    private func checkAndRefreshToken() async {
        guard case .signedIn(let session) = auth.authState else {
            stopMonitoring()
            return
        }

        // Check if token is expiring soon
        let expiresAt = session.expiresAt ?? Date().addingTimeInterval(3600)
        let timeUntilExpiry = expiresAt.timeIntervalSinceNow

        // If token expires within refresh window, refresh it
        if timeUntilExpiry < refreshBeforeExpiry {
            await refreshToken(refreshToken: session.refresh_token)
        }
    }

    /**
     * Force refresh the current token
     * - Parameters:
     *   - refreshToken: The refresh token to use
     */
    func refreshToken(refreshToken: String) async {
        // Rate limit refreshes
        if let lastRefresh = lastRefreshTime,
           Date().timeIntervalSince(lastRefresh) < minRefreshInterval {
            return
        }

        lastRefreshTime = Date()

        do {
            try await auth.refreshSession(refreshToken: refreshToken)
        } catch {
            // Log refresh failure but don't crash
            // The user will be prompted to re-login on next auth check
            print("Token refresh failed: \(error.localizedDescription)")
        }
    }

    /**
     * Deinit - clean up timer
     */
    deinit {
        stopMonitoring()
    }
}
