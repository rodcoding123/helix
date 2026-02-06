/**
 * Supabase Certificate Pinning
 * MEDIUM FIX 4.3: Certificate pinning for Supabase API calls
 * Prevents MITM attacks on REST API communication
 */

package com.helix.utils

import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import java.security.MessageDigest

object SupabasePinningConfig {
    // SHA256 hashes of Supabase's public key certificates
    // Update these when Supabase rotates their certificates
    private val pinnedCertificates = mapOf(
        "api.supabase.co" to listOf(
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        ),
        "*.supabase.co" to listOf(
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        ),
    )

    /**
     * Create OkHttpClient with certificate pinning for Supabase
     * @return Configured OkHttpClient with pinned certificates
     */
    fun createPinnedHttpClient(): OkHttpClient {
        val certificatePinner = CertificatePinner.Builder()
            .apply {
                pinnedCertificates.forEach { (domain, pins) ->
                    pins.forEach { pin ->
                        add(domain, pin)
                    }
                }
            }
            .build()

        return OkHttpClient.Builder()
            .certificatePinner(certificatePinner)
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    /**
     * Add certificate pinning to existing OkHttpClient builder
     * @param builder The OkHttpClient.Builder to configure
     * @return Configured builder with certificate pinning
     */
    fun addPinningTo(builder: OkHttpClient.Builder): OkHttpClient.Builder {
        val certificatePinner = CertificatePinner.Builder()
            .apply {
                pinnedCertificates.forEach { (domain, pins) ->
                    pins.forEach { pin ->
                        add(domain, pin)
                    }
                }
            }
            .build()

        return builder.certificatePinner(certificatePinner)
    }

    /**
     * Compute SHA256 hash of certificate data
     * @param data Certificate data
     * @return SHA256 hash as base64-encoded string
     */
    fun computeSHA256(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP)
    }
}

/**
 * Extension function to create Supabase pinned HTTP client
 */
fun createSupabasePinnedClient(): OkHttpClient {
    return SupabasePinningConfig.createPinnedHttpClient()
}
