/**
 * Gateway Configuration Storage - Helix iOS
 * Persists gateway config (instance key, URL) using Keychain
 */

import Foundation
import Security

struct GatewayConnectionConfig: Codable {
    let instanceKey: String
    let gatewayUrl: String?
    // authToken is fetched dynamically via SupabaseAuthService
}

actor GatewayConfigStorage {
    static let shared = GatewayConfigStorage()

    private let keychain = KeychainHelper()
    private let configKey = "helix_gateway_config"

    func saveConfig(_ config: GatewayConnectionConfig) throws {
        let data = try JSONEncoder().encode(config)
        keychain.save(data, forKey: configKey)
    }

    func loadConfig() -> GatewayConnectionConfig? {
        guard let data = keychain.load(forKey: configKey) else {
            return nil
        }
        return try? JSONDecoder().decode(GatewayConnectionConfig.self, from: data)
    }

    func clearConfig() {
        keychain.delete(forKey: configKey)
    }

    func updateInstanceKey(_ key: String) throws {
        var config = loadConfig() ?? GatewayConnectionConfig(instanceKey: key, gatewayUrl: nil)
        config = GatewayConnectionConfig(instanceKey: key, gatewayUrl: config.gatewayUrl)
        try saveConfig(config)
    }

    func updateGatewayUrl(_ url: String) throws {
        guard let config = loadConfig() else {
            throw GatewayConnectionError(
                code: .connectionFailed,
                message: "No existing config found"
            )
        }
        let updated = GatewayConnectionConfig(instanceKey: config.instanceKey, gatewayUrl: url)
        try saveConfig(updated)
    }
}
