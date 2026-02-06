/**
 * HMAC Verifier - High-level challenge authentication
 * HIGH FIX 2.2: HMAC-based challenge verification for handshake authentication
 * Prevents replay attacks and verifies server authenticity
 */

package com.helix.utils

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.security.SecureRandom

object HMACVerifier {
    private const val ALGORITHM = "HmacSHA256"
    private const val CHALLENGE_BYTES = 32

    /**
     * Verify HMAC signature of a challenge response
     * @param challenge Original challenge string sent to server
     * @param response Server's response that should contain HMAC signature
     * @param secret Shared secret for HMAC verification
     * @return true if HMAC signature is valid
     */
    fun verifyChallenge(challenge: String, response: String, secret: String): Boolean {
        return try {
            val computedHmac = generateSignature(challenge, secret) ?: return false
            // Response should be in format "hmac-<hex>"
            response.endsWith(computedHmac)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Generate HMAC signature for a request
     * @param data Data to sign
     * @param secret Shared secret
     * @return HMAC-SHA256 signature as hex string, or null if error
     */
    fun generateSignature(data: String, secret: String): String? {
        return try {
            val mac = Mac.getInstance(ALGORITHM)
            val secretKey = SecretKeySpec(
                secret.toByteArray(Charsets.UTF_8),
                0,
                secret.length,
                ALGORITHM
            )
            mac.init(secretKey)
            val bytes = mac.doFinal(data.toByteArray(Charsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Generate a cryptographically secure random challenge
     * @return Random challenge string (32 bytes as hex)
     */
    fun generateChallenge(): String {
        return try {
            val random = SecureRandom()
            val bytes = ByteArray(CHALLENGE_BYTES)
            random.nextBytes(bytes)
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            java.util.UUID.randomUUID().toString()
        }
    }

    /**
     * Validate HMAC format (should be hex string)
     * @param hmac HMAC string to validate
     * @return true if valid hex format
     */
    fun isValidHMACFormat(hmac: String): Boolean {
        return hmac.matches(Regex("^[a-f0-9]{64}$"))  // SHA256 = 64 hex chars
    }
}
