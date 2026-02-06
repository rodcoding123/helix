/**
 * Keychain Manager - Secure credential storage for iOS
 * CRITICAL FIX 1.1: Instance keys stored in Keychain only, not in UserDefaults
 */

import Foundation
import Security

enum KeychainError: LocalizedError {
    case saveFailed(OSStatus)
    case retrieveFailed(OSStatus)
    case deleteFailed(OSStatus)
    case unexpectedItemData
    case duplicateItem

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Failed to save to Keychain (status: \(status))"
        case .retrieveFailed(let status):
            return "Failed to retrieve from Keychain (status: \(status))"
        case .deleteFailed(let status):
            return "Failed to delete from Keychain (status: \(status))"
        case .unexpectedItemData:
            return "Unexpected item data format in Keychain"
        case .duplicateItem:
            return "Item already exists in Keychain"
        }
    }
}

final actor KeychainManager {
    static let shared = KeychainManager()

    private let service = "ai.helix.onboarding"

    /**
     * Save a string value to Keychain
     * - Parameters:
     *   - value: String value to save
     *   - key: Unique identifier for the value
     * - Throws: KeychainError if save fails
     */
    func save(_ value: String, for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: value.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        // Delete existing if present
        SecItemDelete(query as CFDictionary)

        // Save new value
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /**
     * Retrieve a string value from Keychain
     * - Parameters:
     *   - key: Unique identifier for the value
     * - Returns: Stored string value, or nil if not found
     * - Throws: KeychainError if retrieval fails
     */
    func retrieve(for key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.retrieveFailed(status)
        }

        guard let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw KeychainError.unexpectedItemData
        }

        return value
    }

    /**
     * Delete a value from Keychain
     * - Parameters:
     *   - key: Unique identifier for the value
     * - Throws: KeychainError if deletion fails
     */
    func delete(for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    /**
     * Check if a value exists in Keychain
     * - Parameters:
     *   - key: Unique identifier to check
     * - Returns: true if value exists
     */
    func exists(for key: String) throws -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess
    }
}
