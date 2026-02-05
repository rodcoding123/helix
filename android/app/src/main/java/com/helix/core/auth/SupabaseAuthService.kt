/**
 * Supabase Authentication Service - Helix Android
 * Handles user authentication with Supabase Auth API
 * Supports email/password sign-in, sign-up, token refresh, and session management
 */

package com.helix.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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

// MARK: - Data Models

@Serializable
data class AuthUser(
    val id: String,
    val email: String?,
    val phone: String?,
    val created_at: String,
    val updated_at: String?,
    val email_confirmed_at: String?,
    val phone_confirmed_at: String?,
    val app_metadata: Map<String, String>? = null,
    val user_metadata: Map<String, String>? = null
)

@Serializable
data class AuthSession(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Long,
    val expires_at: Long? = null,
    val token_type: String,
    val user: AuthUser
)

@Serializable
data class AuthResponse(
    val access_token: String? = null,
    val refresh_token: String? = null,
    val expires_in: Long? = null,
    val expires_at: Long? = null,
    val token_type: String? = null,
    val user: AuthUser? = null,
    val error: String? = null,
    val error_description: String? = null
)

@Serializable
data class SignInRequest(
    val email: String,
    val password: String
)

@Serializable
data class SignUpRequest(
    val email: String,
    val password: String,
    val data: Map<String, String>? = null
)

@Serializable
data class RefreshTokenRequest(
    val refresh_token: String
)

sealed class AuthState {
    object Unknown : AuthState()
    object Loading : AuthState()
    object SignedOut : AuthState()
    data class SignedIn(val session: AuthSession) : AuthState()
    data class Error(val message: String) : AuthState()
}

sealed class AuthResult<out T> {
    data class Success<T>(val data: T) : AuthResult<T>()
    data class Error(val message: String, val code: Int? = null) : AuthResult<Nothing>()
}

// MARK: - Auth Service

class SupabaseAuthService private constructor(
    private val context: Context,
    private val supabaseUrl: String,
    private val supabaseAnonKey: String
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unknown)
    val authState: StateFlow<AuthState> = _authState

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "helix_auth_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val authUrl: String
        get() = "$supabaseUrl/auth/v1"

    // MARK: - Public API

    /**
     * Initialize auth state from stored session
     */
    suspend fun initialize() = withContext(Dispatchers.IO) {
        _authState.value = AuthState.Loading

        val storedSession = loadSession()
        if (storedSession != null) {
            // Check if token is expired
            val expiresAt = storedSession.expires_at ?: (System.currentTimeMillis() / 1000 + storedSession.expires_in)
            val now = System.currentTimeMillis() / 1000

            if (expiresAt > now + 60) { // Valid for at least 60 more seconds
                _authState.value = AuthState.SignedIn(storedSession)
            } else {
                // Try to refresh
                when (val result = refreshToken(storedSession.refresh_token)) {
                    is AuthResult.Success -> {
                        _authState.value = AuthState.SignedIn(result.data)
                    }
                    is AuthResult.Error -> {
                        clearSession()
                        _authState.value = AuthState.SignedOut
                    }
                }
            }
        } else {
            _authState.value = AuthState.SignedOut
        }
    }

    /**
     * Sign in with email and password
     */
    suspend fun signIn(email: String, password: String): AuthResult<AuthSession> = withContext(Dispatchers.IO) {
        _authState.value = AuthState.Loading

        val requestBody = json.encodeToString(SignInRequest(email, password))

        val request = Request.Builder()
            .url("$authUrl/token?grant_type=password")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: return@withContext AuthResult.Error("Empty response")

                if (!response.isSuccessful) {
                    val errorResponse = try {
                        json.decodeFromString<AuthResponse>(body)
                    } catch (e: Exception) {
                        null
                    }
                    val message = errorResponse?.error_description ?: errorResponse?.error ?: "Sign in failed"
                    _authState.value = AuthState.Error(message)
                    return@withContext AuthResult.Error(message, response.code)
                }

                try {
                    val authResponse = json.decodeFromString<AuthResponse>(body)
                    val session = AuthSession(
                        access_token = authResponse.access_token ?: return@withContext AuthResult.Error("No access token"),
                        refresh_token = authResponse.refresh_token ?: return@withContext AuthResult.Error("No refresh token"),
                        expires_in = authResponse.expires_in ?: 3600,
                        expires_at = authResponse.expires_at ?: (System.currentTimeMillis() / 1000 + (authResponse.expires_in ?: 3600)),
                        token_type = authResponse.token_type ?: "bearer",
                        user = authResponse.user ?: return@withContext AuthResult.Error("No user data")
                    )
                    saveSession(session)
                    _authState.value = AuthState.SignedIn(session)
                    AuthResult.Success(session)
                } catch (e: Exception) {
                    _authState.value = AuthState.Error("Failed to parse response")
                    AuthResult.Error("Failed to parse response: ${e.message}")
                }
            }
        } catch (e: IOException) {
            _authState.value = AuthState.Error("Network error")
            AuthResult.Error("Network error: ${e.message}")
        }
    }

    /**
     * Sign up with email and password
     */
    suspend fun signUp(
        email: String,
        password: String,
        metadata: Map<String, String>? = null
    ): AuthResult<AuthSession> = withContext(Dispatchers.IO) {
        _authState.value = AuthState.Loading

        val requestBody = json.encodeToString(SignUpRequest(email, password, metadata))

        val request = Request.Builder()
            .url("$authUrl/signup")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: return@withContext AuthResult.Error("Empty response")

                if (!response.isSuccessful) {
                    val errorResponse = try {
                        json.decodeFromString<AuthResponse>(body)
                    } catch (e: Exception) {
                        null
                    }
                    val message = errorResponse?.error_description ?: errorResponse?.error ?: "Sign up failed"
                    _authState.value = AuthState.Error(message)
                    return@withContext AuthResult.Error(message, response.code)
                }

                try {
                    val authResponse = json.decodeFromString<AuthResponse>(body)

                    // Some Supabase configs require email confirmation, so tokens may be null
                    if (authResponse.access_token == null) {
                        _authState.value = AuthState.SignedOut
                        return@withContext AuthResult.Error("Please check your email to confirm your account")
                    }

                    val session = AuthSession(
                        access_token = authResponse.access_token,
                        refresh_token = authResponse.refresh_token ?: return@withContext AuthResult.Error("No refresh token"),
                        expires_in = authResponse.expires_in ?: 3600,
                        expires_at = authResponse.expires_at ?: (System.currentTimeMillis() / 1000 + (authResponse.expires_in ?: 3600)),
                        token_type = authResponse.token_type ?: "bearer",
                        user = authResponse.user ?: return@withContext AuthResult.Error("No user data")
                    )
                    saveSession(session)
                    _authState.value = AuthState.SignedIn(session)
                    AuthResult.Success(session)
                } catch (e: Exception) {
                    _authState.value = AuthState.Error("Failed to parse response")
                    AuthResult.Error("Failed to parse response: ${e.message}")
                }
            }
        } catch (e: IOException) {
            _authState.value = AuthState.Error("Network error")
            AuthResult.Error("Network error: ${e.message}")
        }
    }

    /**
     * Sign out the current user
     */
    suspend fun signOut(): AuthResult<Unit> = withContext(Dispatchers.IO) {
        val session = (authState.value as? AuthState.SignedIn)?.session

        if (session != null) {
            val request = Request.Builder()
                .url("$authUrl/logout")
                .addHeader("apikey", supabaseAnonKey)
                .addHeader("Authorization", "Bearer ${session.access_token}")
                .post("".toRequestBody())
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    // Sign out locally even if server request fails
                }
            } catch (e: IOException) {
                // Ignore network errors - sign out locally anyway
            }
        }

        clearSession()
        _authState.value = AuthState.SignedOut
        AuthResult.Success(Unit)
    }

    /**
     * Refresh the access token
     */
    suspend fun refreshToken(refreshToken: String? = null): AuthResult<AuthSession> = withContext(Dispatchers.IO) {
        val token = refreshToken ?: (authState.value as? AuthState.SignedIn)?.session?.refresh_token
            ?: return@withContext AuthResult.Error("No refresh token available")

        val requestBody = json.encodeToString(RefreshTokenRequest(token))

        val request = Request.Builder()
            .url("$authUrl/token?grant_type=refresh_token")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Content-Type", "application/json")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: return@withContext AuthResult.Error("Empty response")

                if (!response.isSuccessful) {
                    val errorResponse = try {
                        json.decodeFromString<AuthResponse>(body)
                    } catch (e: Exception) {
                        null
                    }
                    val message = errorResponse?.error_description ?: errorResponse?.error ?: "Token refresh failed"
                    return@withContext AuthResult.Error(message, response.code)
                }

                try {
                    val authResponse = json.decodeFromString<AuthResponse>(body)
                    val session = AuthSession(
                        access_token = authResponse.access_token ?: return@withContext AuthResult.Error("No access token"),
                        refresh_token = authResponse.refresh_token ?: token, // Some providers don't rotate refresh token
                        expires_in = authResponse.expires_in ?: 3600,
                        expires_at = authResponse.expires_at ?: (System.currentTimeMillis() / 1000 + (authResponse.expires_in ?: 3600)),
                        token_type = authResponse.token_type ?: "bearer",
                        user = authResponse.user ?: (authState.value as? AuthState.SignedIn)?.session?.user
                            ?: return@withContext AuthResult.Error("No user data")
                    )
                    saveSession(session)
                    _authState.value = AuthState.SignedIn(session)
                    AuthResult.Success(session)
                } catch (e: Exception) {
                    AuthResult.Error("Failed to parse response: ${e.message}")
                }
            }
        } catch (e: IOException) {
            AuthResult.Error("Network error: ${e.message}")
        }
    }

    /**
     * Get current access token (for API calls)
     * Automatically refreshes if expired
     */
    suspend fun getAccessToken(): String? = withContext(Dispatchers.IO) {
        val session = (authState.value as? AuthState.SignedIn)?.session ?: return@withContext null

        val expiresAt = session.expires_at ?: (System.currentTimeMillis() / 1000 + session.expires_in)
        val now = System.currentTimeMillis() / 1000

        // Refresh if expiring within 5 minutes
        if (expiresAt < now + 300) {
            when (val result = refreshToken()) {
                is AuthResult.Success -> result.data.access_token
                is AuthResult.Error -> null
            }
        } else {
            session.access_token
        }
    }

    /**
     * Get current user
     */
    fun getCurrentUser(): AuthUser? {
        return (authState.value as? AuthState.SignedIn)?.session?.user
    }

    // MARK: - Session Storage

    private fun saveSession(session: AuthSession) {
        val sessionJson = json.encodeToString(session)
        prefs.edit()
            .putString(KEY_SESSION, sessionJson)
            .apply()
    }

    private fun loadSession(): AuthSession? {
        val sessionJson = prefs.getString(KEY_SESSION, null) ?: return null
        return try {
            json.decodeFromString<AuthSession>(sessionJson)
        } catch (e: Exception) {
            null
        }
    }

    private fun clearSession() {
        prefs.edit()
            .remove(KEY_SESSION)
            .apply()
    }

    companion object {
        private const val KEY_SESSION = "auth_session"

        @Volatile
        private var instance: SupabaseAuthService? = null

        fun initialize(
            context: Context,
            supabaseUrl: String,
            supabaseAnonKey: String
        ): SupabaseAuthService {
            return instance ?: synchronized(this) {
                instance ?: SupabaseAuthService(
                    context.applicationContext,
                    supabaseUrl,
                    supabaseAnonKey
                ).also { instance = it }
            }
        }

        fun getInstance(): SupabaseAuthService {
            return instance ?: throw IllegalStateException(
                "SupabaseAuthService not initialized. Call initialize() first."
            )
        }
    }
}
