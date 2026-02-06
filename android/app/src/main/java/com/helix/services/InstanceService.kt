/**
 * Instance Service - Helix Android
 * Manages instance creation and fetching from Supabase
 */

package com.helix.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Serializable
data class Instance(
    val id: String,
    val user_id: String,
    val name: String,
    val instance_key: String,
    val is_active: Boolean,
    val created_at: String,
    val updated_at: String? = null
)

sealed class ApiResult<T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error<T>(val message: String, val code: Int? = null) : ApiResult<T>()
}

class InstanceService(
    private val supabaseUrl: String,
    private val authTokenProvider: suspend () -> String?
) {
    // CRITICAL FIX 5.1: Use backend proxy URL instead of direct Supabase
    private val backendProxyUrl = "$supabaseUrl/functions/v1/mobile-instance-api"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun createInstance(userId: String, name: String, instanceKey: String): ApiResult<Instance> =
        withContext(Dispatchers.IO) {
            try {
                val authToken = authTokenProvider() ?: ""
                // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
                val requestBody = json.encodeToString(mapOf(
                    "name" to name,
                    "instance_key" to instanceKey
                )).toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url(backendProxyUrl)
                    .post(requestBody)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer $authToken")
                    .build()

                val response = httpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    return@withContext ApiResult.Error<Instance>(
                        "HTTP ${response.code}",
                        response.code
                    )
                }

                val body = response.body?.string() ?: ""
                val responseBody = json.decodeFromString<Map<String, Instance>>(body)
                val instance = responseBody["data"] ?: throw Exception("No data in response")
                ApiResult.Success(instance)
            } catch (e: Exception) {
                ApiResult.Error(e.message ?: "Unknown error")
            }
        }

    suspend fun fetchInstances(userId: String): ApiResult<List<Instance>> =
        withContext(Dispatchers.IO) {
            try {
                val authToken = authTokenProvider() ?: ""
                // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
                val url = "$backendProxyUrl?user_id=$userId"

                val request = Request.Builder()
                    .url(url)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer $authToken")
                    .build()

                val response = httpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    return@withContext ApiResult.Error<List<Instance>>(
                        "HTTP ${response.code}",
                        response.code
                    )
                }

                val body = response.body?.string() ?: "[]"
                val responseBody = json.decodeFromString<Map<String, List<Instance>>>(body)
                val instances = responseBody["data"] ?: emptyList()
                ApiResult.Success(instances)
            } catch (e: Exception) {
                ApiResult.Error(e.message ?: "Unknown error")
            }
        }

    suspend fun deleteInstance(instanceId: String): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val authToken = authTokenProvider() ?: ""
                // CRITICAL FIX 5.1: Use backend proxy instead of direct Supabase API call
                val url = "$backendProxyUrl?id=$instanceId"

                val request = Request.Builder()
                    .url(url)
                    .delete()
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer $authToken")
                    .build()

                val response = httpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    return@withContext ApiResult.Error<Unit>(
                        "HTTP ${response.code}",
                        response.code
                    )
                }

                ApiResult.Success(Unit)
            } catch (e: Exception) {
                ApiResult.Error(e.message ?: "Unknown error")
            }
        }
}
