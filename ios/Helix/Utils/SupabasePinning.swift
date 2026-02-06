/**
 * Supabase Certificate Pinning
 * MEDIUM FIX 4.3: Certificate pinning for Supabase API calls
 * Prevents MITM attacks on REST API communication
 */

import Foundation

struct SupabasePinningConfig {
    // SHA256 hashes of Supabase's public key certificates
    // Update these when Supabase rotates their certificates
    static let pinnedCertificates = [
        "api.supabase.co": [
            // Primary certificate hash
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            // Secondary certificate hash for redundancy
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        ],
        "*.supabase.co": [
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        ],
    ]
}

/**
 * Supabase Certificate Pinning Delegate
 * Validates Supabase API certificates during URLSession connections
 */
class SupabasePinningDelegate: NSObject, URLSessionDelegate {
    static let shared = SupabasePinningDelegate()

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        let host = challenge.protectionSpace.host

        // Verify basic SSL certificate chain
        var secResult = SecTrustResultType.invalid
        let status = SecTrustEvaluate(serverTrust, &secResult)

        guard status == errSecSuccess, secResult == .unspecified || secResult == .proceed else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Perform certificate pinning verification
        if verifyPublicKeyPinning(serverTrust, for: host) {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    private func verifyPublicKeyPinning(_ serverTrust: SecTrust, for host: String) -> Bool {
        // Get pinned certificates for this host
        var pinnedKeys = SupabasePinningConfig.pinnedCertificates[host]

        // Try wildcard match if specific host not found
        if pinnedKeys == nil {
            for (pattern, keys) in SupabasePinningConfig.pinnedCertificates {
                if pattern.hasPrefix("*.") {
                    let domain = pattern.dropFirst(2)
                    if host.hasSuffix(String(domain)) {
                        pinnedKeys = keys
                        break
                    }
                }
            }
        }

        guard let keys = pinnedKeys, !keys.isEmpty else {
            // No pinning configured for this host, allow
            return true
        }

        // Check certificate chain
        let certificateCount = SecTrustGetCertificateCount(serverTrust)

        for i in 0..<certificateCount {
            guard let certificate = SecTrustGetCertificateAtIndex(serverTrust, i) else {
                continue
            }

            // Extract public key and create hash
            if let publicKey = SecCertificateCopyKey(certificate),
               let publicKeyData = getPublicKeyData(publicKey) {
                let publicKeyHash = sha256Hash(publicKeyData)

                // Check against pinned hashes
                for pinnedHash in keys {
                    // Remove "sha256/" prefix if present
                    let hashWithoutPrefix = pinnedHash.hasPrefix("sha256/")
                        ? String(pinnedHash.dropFirst(7))
                        : pinnedHash

                    if publicKeyHash == hashWithoutPrefix {
                        return true
                    }
                }
            }
        }

        return false
    }

    private func getPublicKeyData(_ publicKey: SecKey) -> Data? {
        var error: Unmanaged<CFError>?
        guard let keyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            return nil
        }
        return keyData
    }

    private func sha256Hash(_ data: Data) -> String {
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes { buffer in
            if let baseAddress = buffer.baseAddress {
                // This requires CommonCrypto or CryptoKit
                // Using CryptoKit for modern iOS
                let hash = CryptoKit.SHA256.hash(data: data)
                var bytes = [UInt8]()
                for byte in hash {
                    bytes.append(byte)
                }
                digest = bytes
            }
        }
        return digest.map { String(format: "%02hhx", $0) }.joined()
    }
}

// Add import for CryptoKit
import CryptoKit
import CommonCrypto
