/**
 * Intelligence Settings API Service - Phase 8 Android
 * Handles communication with the Supabase intelligence-settings Edge Function
 */

package com.helix.features.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

@Serializable
data class OperationSettingResponse(
    val operation_id: String,
    val operation_name: String,
    val description: String?,
    val primary_model: String,
    val fallback_model: String?,
    val cost_criticality: String,
    val estimated_cost_usd: Double,
    val enabled: Boolean
)

@Serializable
data class BudgetSettingResponse(
    val daily_limit_usd: Double,
    val monthly_limit_usd: Double,
    val warning_threshold: Int
)

@Serializable
data class UsageStatsResponse(
    val daily_usd: Double,
    val monthly_usd: Double,
    val daily_operations: Int,
    val monthly_operations: Int,
    val budget_status: String
)

@Serializable
data class IntelligenceSettingsResponse(
    val operations: List<OperationSettingResponse>,
    val budget: BudgetSettingResponse,
    val usage: UsageStatsResponse
)

@Serializable
data class OperationSettingSaveRequest(
    val operation_id: String,
    val enabled: Boolean
)

@Serializable
data class BudgetSettingSaveRequest(
    val daily_limit_usd: Double,
    val monthly_limit_usd: Double,
    val warning_threshold: Int
)

@Serializable
data class IntelligenceSettingsSaveRequest(
    val operations: List<OperationSettingSaveRequest>,
    val budget: BudgetSettingSaveRequest
)

@Serializable
data class SaveResponse(
    val success: Boolean
)

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
}

class IntelligenceSettingsService private constructor(
    private val supabaseUrl: String,
    private val authTokenProvider: suspend () -> String?
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val baseUrl: String
        get() = "$supabaseUrl/functions/v1/intelligence-settings"

    suspend fun fetchSettings(): ApiResult<IntelligenceSettingsResponse> = withContext(Dispatchers.IO) {
        val token = authTokenProvider.invoke() ?: return@withContext ApiResult.Error("Not authenticated")

        val request = Request.Builder()
            .url(baseUrl)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext ApiResult.Error(
                        "HTTP ${response.code}: ${response.message}",
                        response.code
                    )
                }

                val body = response.body?.string()
                    ?: return@withContext ApiResult.Error("Empty response body")

                try {
                    val settings = json.decodeFromString<IntelligenceSettingsResponse>(body)
                    ApiResult.Success(settings)
                } catch (e: Exception) {
                    ApiResult.Error("Failed to parse response: ${e.message}")
                }
            }
        } catch (e: IOException) {
            ApiResult.Error("Network error: ${e.message}")
        }
    }

    suspend fun saveSettings(
        operations: List<OperationSettingSaveRequest>,
        budget: BudgetSettingSaveRequest
    ): ApiResult<SaveResponse> = withContext(Dispatchers.IO) {
        val token = authTokenProvider.invoke() ?: return@withContext ApiResult.Error("Not authenticated")

        val requestBody = IntelligenceSettingsSaveRequest(operations, budget)
        val jsonBody = json.encodeToString(requestBody)

        val request = Request.Builder()
            .url(baseUrl)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext ApiResult.Error(
                        "HTTP ${response.code}: ${response.message}",
                        response.code
                    )
                }

                val body = response.body?.string()
                    ?: return@withContext ApiResult.Error("Empty response body")

                try {
                    val result = json.decodeFromString<SaveResponse>(body)
                    ApiResult.Success(result)
                } catch (e: Exception) {
                    ApiResult.Error("Failed to parse response: ${e.message}")
                }
            }
        } catch (e: IOException) {
            ApiResult.Error("Network error: ${e.message}")
        }
    }

    companion object {
        @Volatile
        private var instance: IntelligenceSettingsService? = null

        fun getInstance(
            supabaseUrl: String,
            authTokenProvider: suspend () -> String?
        ): IntelligenceSettingsService {
            return instance ?: synchronized(this) {
                instance ?: IntelligenceSettingsService(supabaseUrl, authTokenProvider).also {
                    instance = it
                }
            }
        }

        /**
         * Initialize with SupabaseAuthService for automatic token management
         */
        fun initializeWithAuth(
            supabaseUrl: String,
            authService: com.helix.core.auth.SupabaseAuthService
        ): IntelligenceSettingsService {
            return getInstance(supabaseUrl) { authService.getAccessToken() }
        }
    }
}
