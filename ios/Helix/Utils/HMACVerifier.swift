/**
 * HMAC Verifier - High-level challenge authentication
 * HIGH FIX 2.2: HMAC-based challenge verification for handshake authentication
 * Prevents replay attacks and verifies server authenticity
 */

import Foundation
import CryptoKit

struct HMACVerifier {
    /**
     * Verify HMAC signature of a challenge response
     * - Parameters:
     *   - challenge: Original challenge string sent to server
     *   - response: Server's response that should contain HMAC signature
     *   - secret: Shared secret for HMAC verification (from instance key or config)
     * - Returns: true if HMAC signature is valid
     */
    static func verifyChallenge(
        challenge: String,
        response: String,
        secret: String
    ) -> Bool {
        guard let challengeData = challenge.data(using: .utf8),
              let secretData = secret.data(using: .utf8) else {
            return false
        }

        // Compute HMAC-SHA256 of the challenge
        let signature = HMAC<SHA256>.authenticationCode(
            for: challengeData,
            using: SymmetricKey(data: secretData)
        )

        // Convert to hex string for comparison
        let computedHmac = Data(signature).map { String(format: "%02hhx", $0) }.joined()

        // Compare with server's response (should be in format "hmac-<hex>")
        return response.hasSuffix(computedHmac)
    }

    /**
     * Generate HMAC signature for a request
     * - Parameters:
     *   - data: Data to sign
     *   - secret: Shared secret
     * - Returns: HMAC-SHA256 signature as hex string
     */
    static func generateSignature(for data: String, secret: String) -> String? {
        guard let dataBytes = data.data(using: .utf8),
              let secretData = secret.data(using: .utf8) else {
            return nil
        }

        let signature = HMAC<SHA256>.authenticationCode(
            for: dataBytes,
            using: SymmetricKey(data: secretData)
        )

        return Data(signature).map { String(format: "%02hhx", $0) }.joined()
    }

    /**
     * Generate a cryptographically secure random challenge
     * - Returns: Random challenge string (32 bytes as hex)
     */
    static func generateChallenge() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        if status == errSecSuccess {
            return bytes.map { String(format: "%02hhx", $0) }.joined()
        }

        return UUID().uuidString  // Fallback to UUID
    }
}
