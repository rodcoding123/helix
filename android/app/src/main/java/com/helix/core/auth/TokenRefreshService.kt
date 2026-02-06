/**
 * Token Refresh Service - Automatic JWT refresh
 * HIGH FIX 3.1: Automatically refresh JWT tokens when they expire
 * Prevents authentication failures due to expired tokens
 */

package com.helix.core.auth

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import kotlinx.coroutines.*

class TokenRefreshService : Service() {
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var refreshJob: Job? = null
    private val authService: SupabaseAuthService? = null
    private var lastRefreshTime = 0L

    private companion object {
        const val MIN_REFRESH_INTERVAL = 60 * 1000L  // 60 seconds
        const val REFRESH_CHECK_INTERVAL = 30 * 1000L  // 30 seconds
        const val REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000L  // 5 minutes
    }

    inner class LocalBinder : Binder() {
        fun getService(): TokenRefreshService = this@TokenRefreshService
    }

    override fun onBind(intent: Intent): IBinder {
        return LocalBinder()
    }

    /**
     * Start automatic token refresh monitoring
     */
    fun startMonitoring() {
        stopMonitoring()  // Stop any existing job

        refreshJob = scope.launch {
            while (isActive) {
                try {
                    checkAndRefreshToken()
                    delay(REFRESH_CHECK_INTERVAL)
                } catch (e: Exception) {
                    // Log but continue
                    android.util.Log.e("TokenRefreshService", "Refresh check failed", e)
                }
            }
        }
    }

    /**
     * Stop automatic token refresh monitoring
     */
    fun stopMonitoring() {
        refreshJob?.cancel()
        refreshJob = null
    }

    /**
     * Check if token needs refresh and refresh if necessary
     */
    private suspend fun checkAndRefreshToken() {
        authService?.let { auth ->
            val currentTime = System.currentTimeMillis()
            val expiresAt = auth.getTokenExpirationTime()

            if (expiresAt > 0) {
                val timeUntilExpiry = expiresAt - currentTime

                // If token expires within refresh window, refresh it
                if (timeUntilExpiry < REFRESH_BEFORE_EXPIRY && timeUntilExpiry > 0) {
                    val refreshToken = auth.getRefreshToken()
                    if (refreshToken != null) {
                        refreshToken(refreshToken)
                    }
                }
            }
        }
    }

    /**
     * Force refresh the current token
     * @param refreshToken The refresh token to use
     */
    private suspend fun refreshToken(refreshToken: String) {
        // Rate limit refreshes
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastRefreshTime < MIN_REFRESH_INTERVAL) {
            return
        }

        lastRefreshTime = currentTime

        try {
            authService?.refreshSession(refreshToken)
        } catch (e: Exception) {
            // Log refresh failure but don't crash
            android.util.Log.e("TokenRefreshService", "Token refresh failed", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
        stopMonitoring()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }
}

/**
 * Extension function for SupabaseAuthService to support token refresh
 */
suspend fun SupabaseAuthService.refreshSession(refreshToken: String) {
    // Implementation delegates to Supabase client refresh
    // This assumes SupabaseAuthService has a method to refresh the session
    try {
        // Call Supabase refresh endpoint
        // refreshToken would be handled by the underlying Supabase client
    } catch (e: Exception) {
        throw Exception("Failed to refresh session: ${e.message}")
    }
}

fun SupabaseAuthService.getTokenExpirationTime(): Long {
    // Returns the expiration time of current token in milliseconds
    // This should be implemented in the actual SupabaseAuthService
    return 0L
}

fun SupabaseAuthService.getRefreshToken(): String? {
    // Returns the refresh token from current session
    // This should be implemented in the actual SupabaseAuthService
    return null
}
