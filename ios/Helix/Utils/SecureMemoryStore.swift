/**
 * Secure Memory Store - Memory-safe credential storage using mlock
 * HIGH FIX 3.2: Credentials stored in memory locked against swapping
 * Prevents sensitive data from being written to disk
 */

import Foundation

/**
 * SecureMemoryStore uses mlock to prevent memory pages from being swapped to disk
 * This is critical for storing sensitive credentials like tokens and keys
 */
final class SecureMemoryStore {
    private var data: Data
    private var isLocked = false

    /**
     * Initialize with data to be securely stored
     * - Parameter data: Sensitive data to store
     */
    init(data: Data) {
        self.data = data
        lockMemory()
    }

    /**
     * Get the secure data
     * - Returns: The stored data
     */
    func getData() -> Data {
        return data
    }

    /**
     * Lock memory pages to prevent swapping to disk
     */
    private func lockMemory() {
        guard !isLocked else { return }

        // mlock the data to prevent it from being swapped to disk
        let result = data.withUnsafeBytes { buffer -> Int32 in
            if let baseAddress = buffer.baseAddress {
                return mlock(baseAddress, buffer.count)
            }
            return -1
        }

        if result == 0 {
            isLocked = true
        } else {
            // Log warning but don't fail - mlock may not be available on all systems
            print("Warning: Failed to lock memory pages (mlock returned \(result))")
        }
    }

    /**
     * Unlock memory pages and wipe sensitive data
     */
    func unlock() {
        if isLocked {
            let result = data.withUnsafeBytes { buffer -> Int32 in
                if let baseAddress = buffer.baseAddress {
                    // Wipe the memory before unlocking
                    memset(baseAddress, 0, buffer.count)
                    return munlock(baseAddress, buffer.count)
                }
                return -1
            }

            if result == 0 {
                isLocked = false
            }
        }

        // Clear the data reference
        data = Data()
    }

    /**
     * Deinitializer - unlock and wipe memory
     */
    deinit {
        unlock()
    }
}

/**
 * Secure token holder that uses mlock
 */
final class SecureToken {
    private let store: SecureMemoryStore
    private let expiresAt: Date?

    /**
     * Initialize with token string
     * - Parameter token: JWT token or similar credential
     * - Parameter expiresAt: Optional expiration date
     */
    init(token: String, expiresAt: Date? = nil) {
        self.store = SecureMemoryStore(data: token.data(using: .utf8) ?? Data())
        self.expiresAt = expiresAt
    }

    /**
     * Get the token as a string
     * - Returns: The token string
     */
    func getToken() -> String {
        guard let token = String(data: store.getData(), encoding: .utf8) else {
            return ""
        }
        return token
    }

    /**
     * Check if token is expired
     * - Returns: true if token is expired, false if still valid
     */
    func isExpired() -> Bool {
        guard let expiresAt = expiresAt else {
            return false
        }
        return Date() > expiresAt
    }

    /**
     * Check if token expires soon (within specified interval)
     * - Parameter interval: Time interval to check (default 5 minutes)
     * - Returns: true if token expires within interval
     */
    func expiresSoon(within interval: TimeInterval = 5 * 60) -> Bool {
        guard let expiresAt = expiresAt else {
            return false
        }
        return expiresAt.timeIntervalSinceNow < interval
    }

    /**
     * Destroy the token and wipe memory
     */
    func destroy() {
        store.unlock()
    }

    deinit {
        destroy()
    }
}

/**
 * Extension to prevent Foundation's String from being swapped
 */
extension String {
    /**
     * Create secure version of string using mlock
     * - Returns: SecureToken wrapping this string
     */
    func toSecureToken(expiresAt: Date? = nil) -> SecureToken {
        return SecureToken(token: self, expiresAt: expiresAt)
    }
}
