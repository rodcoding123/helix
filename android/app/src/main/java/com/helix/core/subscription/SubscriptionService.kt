/**
 * Subscription Service - Helix Android
 * Fetches and manages subscription tier from Supabase
 */

package com.helix.core.subscription

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class SubscriptionService(
    context: Context,
    private val authTokenProvider: suspend () -> String?,
    private val supabaseUrl: String = "",
    private val supabaseAnonKey: String = ""
) {
    private val actualSupabaseUrl = supabaseUrl.ifEmpty {
        context.applicationContext.packageManager
            .getApplicationInfo(context.packageName, 128)
            .metaData?.getString("SUPABASE_URL") ?: "https://supabase.com"
    }

    private val actualSupabaseAnonKey = supabaseAnonKey.ifEmpty {
        context.applicationContext.packageManager
            .getApplicationInfo(context.packageName, 128)
            .metaData?.getString("SUPABASE_ANON_KEY") ?: ""
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    private val _subscription = MutableStateFlow<Subscription?>(null)
    val subscription: StateFlow<Subscription?> = _subscription.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<Throwable?>(null)
    val error: StateFlow<Throwable?> = _error.asStateFlow()

    val userTier: SubscriptionTier
        get() = subscription.value?.tier ?: SubscriptionTier.CORE

    val hasArchitectAccess: Boolean
        get() = userTier.hasAccess(SubscriptionTier.ARCHITECT)

    val hasOverseerAccess: Boolean
        get() = userTier.hasAccess(SubscriptionTier.OVERSEER)

    val hasPhantomAccess: Boolean
        get() = userTier.hasAccess(SubscriptionTier.PHANTOM)

    suspend fun fetchSubscription(userId: String) {
        _isLoading.value = true
        try {
            val authToken = authTokenProvider() ?: ""
            val urlString = "$actualSupabaseUrl/rest/v1/subscriptions?user_id=eq.$userId"

            val request = Request.Builder()
                .url(urlString)
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer $authToken")
                .header("apikey", actualSupabaseAnonKey)
                .build()

            val response = httpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                throw Exception("HTTP error: ${response.code}")
            }

            val body = response.body?.string() ?: ""
            val subscriptions = json.decodeFromString<List<Subscription>>(body)

            _subscription.value = subscriptions.firstOrNull()
            _error.value = null
        } catch (e: Exception) {
            _error.value = e
            println("[SubscriptionService] Failed to fetch subscription: ${e.message}")
        } finally {
            _isLoading.value = false
        }
    }

    fun hasAccess(tier: SubscriptionTier): Boolean {
        return userTier.hasAccess(tier)
    }

    fun clearCache() {
        _subscription.value = null
        _error.value = null
    }
}
