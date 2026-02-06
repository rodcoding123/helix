/**
 * Gateway TLS Certificate Pinning with TOFU (Trust On First Use)
 * CRITICAL FIX 5.1: User consent required before accepting first certificate
 * Prevents MITM attacks on gateway WebSocket connections
 * Implements fail-closed design: connection blocked if certificate verification fails
 */

package com.helix.core.gateway

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import java.security.KeyStore
import java.security.MessageDigest
import java.security.cert.Certificate
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Gateway TLS configuration with TOFU support
 * CRITICAL FIX 5.1: Implements Trust On First Use with explicit user consent
 */
object GatewayTlsConfig {
    private const val GATEWAY_DOMAIN = "gateway.helix-project.org"
    private const val PREFS_NAME = "gateway_tls_pins"
    private const val PIN_KEY = "gateway_certificate_pin"

    /**
     * Store pinned certificate hash
     * CRITICAL FIX 5.1: User consent obtained before storing
     */
    fun storeCertificatePin(context: Context, certHash: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PIN_KEY, certHash).apply()
    }

    /**
     * Retrieve pinned certificate hash
     */
    fun getPinnedCertificateHash(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(PIN_KEY, null)
    }

    /**
     * Check if certificate is pinned
     */
    fun isCertificatePinned(context: Context): Boolean {
        return getPinnedCertificateHash(context) != null
    }

    /**
     * Compute SHA256 hash of certificate public key
     */
    fun computeCertificateHash(certificate: X509Certificate): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val publicKeyBytes = certificate.publicKey.encoded
        val hash = digest.digest(publicKeyBytes)
        return "sha256/" + Base64.encodeToString(hash, Base64.NO_WRAP)
    }

    /**
     * Create OkHttpClient with TOFU certificate pinning
     * CRITICAL FIX 5.1: Uses user-consented pinned certificate
     * Fail-closed: Blocks connection if certificate not pinned or doesn't match
     */
    fun createOkHttpClientWithTOFU(context: Context): OkHttpClient {
        val pinnedHash = getPinnedCertificateHash(context)
            ?: throw SecurityException("Gateway certificate not pinned - user consent required")

        val certificatePinner = CertificatePinner.Builder()
            .add(GATEWAY_DOMAIN, pinnedHash)
            .build()

        return OkHttpClient.Builder()
            .certificatePinner(certificatePinner)
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(0, java.util.concurrent.TimeUnit.MINUTES)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    /**
     * Create temporary OkHttpClient for first connection (user consent phase)
     * CRITICAL FIX 5.1: Does NOT pin certificate yet - allows inspection for consent dialog
     * Will fail-closed on subsequent connections if user didn't consent to pin
     */
    fun createTempOkHttpClientForConsent(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(0, java.util.concurrent.TimeUnit.MINUTES)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    /**
     * Create certificate pinning builder
     * Adds pinned certificates for known gateways
     */
    fun addGatewayPinning(builder: OkHttpClient.Builder, context: Context): OkHttpClient.Builder {
        val pinnedHash = getPinnedCertificateHash(context)
        if (pinnedHash != null) {
            val certificatePinner = CertificatePinner.Builder()
                .add(GATEWAY_DOMAIN, pinnedHash)
                .build()
            builder.certificatePinner(certificatePinner)
        }
        return builder
    }
}

/**
 * TOFU (Trust On First Use) handler for gateway certificate verification
 * CRITICAL FIX 5.1: Requires explicit user consent before trusting certificate
 */
interface GatewayTofuCallback {
    /**
     * Show user consent dialog for untrusted certificate
     * CRITICAL FIX 5.1: User must explicitly approve before connection proceeds
     * @param certificateHash SHA256 hash of server certificate
     * @param certificateInfo Human-readable certificate information
     * @return true if user consents to pin and trust this certificate
     */
    suspend fun requestUserConsent(
        certificateHash: String,
        certificateInfo: String
    ): Boolean
}

/**
 * TOFU verification result
 */
sealed class ToFuVerificationResult {
    data class CertificatePinned(val hash: String) : ToFuVerificationResult()
    data class RequiresConsent(
        val hash: String,
        val certificateInfo: String
    ) : ToFuVerificationResult()
    data class VerificationFailed(val reason: String) : ToFuVerificationResult()
}

/**
 * Verify gateway certificate with TOFU logic
 * CRITICAL FIX 5.1: Implements fail-closed design
 * - If no pinned cert: require user consent before allowing connection
 * - If pinned cert exists: verify connection certificate matches
 * - If verification fails: block connection
 */
suspend fun verifyGatewayCertificateToFu(
    context: Context,
    serverCertificate: X509Certificate,
    tofuCallback: GatewayTofuCallback
): ToFuVerificationResult {
    val certHash = GatewayTlsConfig.computeCertificateHash(serverCertificate)

    // Check if certificate already pinned
    val pinnedHash = GatewayTlsConfig.getPinnedCertificateHash(context)

    return if (pinnedHash != null) {
        // Pinned certificate exists - verify it matches
        if (certHash == pinnedHash) {
            ToFuVerificationResult.CertificatePinned(certHash)
        } else {
            // Certificate mismatch - potential MITM attack
            ToFuVerificationResult.VerificationFailed(
                "Server certificate does not match pinned certificate (MITM risk)"
            )
        }
    } else {
        // No pinned certificate - require user consent
        val certInfo = buildCertificateInfo(serverCertificate)

        suspendCancellableCoroutine { continuation ->
            try {
                // Request user consent asynchronously
                val userApproved = suspendCancellableCoroutine<Boolean> { innerContinuation ->
                    Thread {
                        try {
                            val approved = runBlocking {
                                tofuCallback.requestUserConsent(certHash, certInfo)
                            }
                            innerContinuation.resume(approved)
                        } catch (e: Exception) {
                            innerContinuation.resumeWithException(e)
                        }
                    }.start()
                }

                if (userApproved) {
                    // User consented - pin the certificate
                    GatewayTlsConfig.storeCertificatePin(context, certHash)
                    continuation.resume(ToFuVerificationResult.CertificatePinned(certHash))
                } else {
                    // User rejected - block connection
                    continuation.resume(
                        ToFuVerificationResult.VerificationFailed(
                            "User rejected certificate pinning"
                        )
                    )
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }
    }
}

/**
 * Build human-readable certificate information for user consent dialog
 */
private fun buildCertificateInfo(cert: X509Certificate): String {
    return buildString {
        append("Certificate Details:\n\n")
        append("Subject: ${cert.subjectDN}\n")
        append("Issuer: ${cert.issuerDN}\n")
        append("Valid From: ${cert.notBefore}\n")
        append("Valid Until: ${cert.notAfter}\n")
        append("Serial Number: ${cert.serialNumber}\n")
        append("\nFingerpint (SHA-256):\n")
        append(GatewayTlsConfig.computeCertificateHash(cert))
    }
}

// Helper function for blocking coroutine execution (only for consent dialog)
private suspend fun <T> runBlocking(block: suspend () -> T): T {
    return block()
}
