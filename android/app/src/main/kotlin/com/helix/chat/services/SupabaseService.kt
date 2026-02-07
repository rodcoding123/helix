package com.helix.chat.services

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.helix.chat.models.Conversation
import com.helix.chat.models.Message
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import timber.log.Timber

/**
 * Supabase Service
 *
 * Handles all Supabase operations including authentication, data access, and real-time subscriptions.
 * Provides a clean interface for the UI layer to interact with the backend.
 */
class SupabaseService(private val context: Context) {
    // Configuration
    companion object {
        private const val SUPABASE_URL = "https://your-project.supabase.co"
        private const val SUPABASE_ANON_KEY = "your-anon-key"

        private val TOKEN_KEY = stringPreferencesKey("auth_token")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
    }

    // State
    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUser = MutableStateFlow<String?>(null)
    val currentUser: StateFlow<String?> = _currentUser.asStateFlow()

    // Supabase client
    private val supabaseClient: SupabaseClient = createSupabaseClient(
        supabaseUrl = SUPABASE_URL,
        supabaseKey = SUPABASE_ANON_KEY
    )

    private val dataStore = context.dataStore
    private val scope = CoroutineScope(Dispatchers.IO)

    // Real-time subscriptions
    private var conversationsChannel: RealtimeChannel? = null
    private var messagesChannel: RealtimeChannel? = null

    /**
     * Check current authentication status
     */
    suspend fun checkAuthStatus(): Boolean {
        return try {
            val session = supabaseClient.auth.currentSessionOrNull()
            if (session != null) {
                _currentUser.emit(session.user?.id?.toString())
                _isAuthenticated.emit(true)
                true
            } else {
                _isAuthenticated.emit(false)
                false
            }
        } catch (e: Exception) {
            Timber.e(e, "Auth status check failed")
            _isAuthenticated.emit(false)
            false
        }
    }

    /**
     * Sign up with email and password
     */
    suspend fun signUp(email: String, password: String): Boolean {
        return try {
            supabaseClient.auth.signUpWith(
                credentials = io.github.jan.supabase.auth.OAuthGrantTypes.PasswordGrant(
                    email = email,
                    password = password
                )
            )

            val session = supabaseClient.auth.currentSessionOrNull()
            if (session != null) {
                _currentUser.emit(session.user?.id?.toString())
                _isAuthenticated.emit(true)
                saveAuthToken(session.accessToken)

                // Register device for push notifications (Phase 4.5)
                // Note: Token will be registered via FCM onNewToken callback
                Timber.d("Sign up successful, waiting for FCM device token")

                true
            } else {
                false
            }
        } catch (e: Exception) {
            Timber.e(e, "Sign up failed")
            throw HelixError("SIGNUP_FAILED", e.localizedMessage ?: "Sign up failed")
        }
    }

    /**
     * Sign in with email and password
     */
    suspend fun signIn(email: String, password: String): Boolean {
        return try {
            supabaseClient.auth.signInWith(
                credentials = io.github.jan.supabase.auth.OAuthGrantTypes.PasswordGrant(
                    email = email,
                    password = password
                )
            )

            val session = supabaseClient.auth.currentSessionOrNull()
            if (session != null) {
                _currentUser.emit(session.user?.id?.toString())
                _isAuthenticated.emit(true)
                saveAuthToken(session.accessToken)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Timber.e(e, "Sign in failed")
            throw HelixError("SIGNIN_FAILED", e.localizedMessage ?: "Sign in failed")
        }
    }

    /**
     * Sign out
     */
    suspend fun signOut() {
        try {
            supabaseClient.auth.signOut()
            _isAuthenticated.emit(false)
            _currentUser.emit(null)
            clearAuthToken()
        } catch (e: Exception) {
            Timber.e(e, "Sign out failed")
        }
    }

    /**
     * Load conversations for current user
     */
    suspend fun loadConversations(): List<Conversation> {
        return try {
            val userId = _currentUser.value ?: return emptyList()

            supabaseClient.postgrest
                .from("conversations")
                .select()
                .eq("user_id", userId)
                .order("updated_at", ascending = false)
                .decodeList<Conversation>()
        } catch (e: Exception) {
            Timber.e(e, "Failed to load conversations")
            throw HelixError("LOAD_FAILED", e.localizedMessage ?: "Failed to load conversations")
        }
    }

    /**
     * Create new conversation
     */
    suspend fun createConversation(title: String): Conversation {
        return try {
            val userId = _currentUser.value ?: throw HelixError("AUTH_FAILED", "Not authenticated")

            val newConversation = mapOf(
                "session_key" to java.util.UUID.randomUUID().toString(),
                "user_id" to userId,
                "title" to title,
                "created_at" to java.time.Instant.now().toString(),
                "updated_at" to java.time.Instant.now().toString(),
                "message_count" to 0
            )

            supabaseClient.postgrest
                .from("conversations")
                .insert(newConversation)
                .decodeAs<Conversation>()
        } catch (e: Exception) {
            Timber.e(e, "Failed to create conversation")
            throw HelixError("CREATE_FAILED", e.localizedMessage ?: "Failed to create conversation")
        }
    }

    /**
     * Load messages for conversation
     */
    suspend fun loadMessages(sessionKey: String, limit: Int = 50): List<Message> {
        return try {
            supabaseClient.postgrest
                .from("session_messages")
                .select()
                .eq("session_key", sessionKey)
                .order("timestamp", ascending = true)
                .limit(limit)
                .decodeList<Message>()
        } catch (e: Exception) {
            Timber.e(e, "Failed to load messages")
            throw HelixError("LOAD_FAILED", e.localizedMessage ?: "Failed to load messages")
        }
    }

    /**
     * Send message
     */
    suspend fun sendMessage(
        content: String,
        sessionKey: String,
        clientId: String? = null
    ): Message {
        return try {
            val userId = _currentUser.value ?: throw HelixError("AUTH_FAILED", "Not authenticated")

            val message = mapOf(
                "id" to java.util.UUID.randomUUID().toString(),
                "session_key" to sessionKey,
                "user_id" to userId,
                "role" to "user",
                "content" to content,
                "timestamp" to java.time.Instant.now().toString(),
                "client_id" to (clientId ?: java.util.UUID.randomUUID().toString()),
                "platform" to "android",
                "device_id" to getDeviceId()
            )

            supabaseClient.postgrest
                .from("session_messages")
                .insert(message)
                .decodeAs<Message>()
        } catch (e: Exception) {
            Timber.e(e, "Failed to send message")
            throw HelixError("SEND_FAILED", e.localizedMessage ?: "Failed to send message")
        }
    }

    /**
     * Subscribe to conversation messages in real-time
     */
    suspend fun subscribeToMessages(
        sessionKey: String,
        onNewMessages: suspend (List<Message>) -> Unit
    ) {
        try {
            messagesChannel = supabaseClient.realtime.channel("messages:$sessionKey")

            messagesChannel?.on("postgres_changes") { action, payload ->
                scope.launch {
                    try {
                        // Reload messages when new message arrives
                        val messages = loadMessages(sessionKey)
                        onNewMessages(messages)
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to reload messages")
                    }
                }
            }

            messagesChannel?.subscribe()
        } catch (e: Exception) {
            Timber.e(e, "Failed to subscribe to messages")
        }
    }

    /**
     * Subscribe to conversations in real-time
     */
    suspend fun subscribeToConversations(
        onConversationsChanged: suspend (List<Conversation>) -> Unit
    ) {
        try {
            conversationsChannel = supabaseClient.realtime.channel("conversations")

            conversationsChannel?.on("postgres_changes") { action, payload ->
                scope.launch {
                    try {
                        val conversations = loadConversations()
                        onConversationsChanged(conversations)
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to reload conversations")
                    }
                }
            }

            conversationsChannel?.subscribe()
        } catch (e: Exception) {
            Timber.e(e, "Failed to subscribe to conversations")
        }
    }

    /**
     * Sync offline messages
     */
    suspend fun syncMessages(messages: List<Message>): Pair<Int, Int> {
        return try {
            val session = supabaseClient.auth.currentSessionOrNull()
                ?: throw HelixError("AUTH_FAILED", "Not authenticated")

            val syncPayload = mapOf(
                "deviceId" to getDeviceId(),
                "platform" to "android",
                "messages" to messages.map { msg ->
                    mapOf(
                        "clientId" to msg.clientId,
                        "content" to msg.content,
                        "sessionKey" to msg.sessionKey,
                        "role" to msg.role.name.lowercase()
                    )
                }
            )

            // Call sync-messages edge function
            val response = supabaseClient.postgrest.rpc(
                "sync_messages",
                parameters = syncPayload
            )

            // Parse response
            Pair(
                response.jsonArray.size, // synced
                0 // failed (would be in response errors)
            )
        } catch (e: Exception) {
            Timber.e(e, "Sync failed")
            throw HelixError("SYNC_FAILED", e.localizedMessage ?: "Sync failed")
        }
    }

    /**
     * Unsubscribe from real-time channels
     */
    fun unsubscribeAll() {
        scope.launch {
            try {
                messagesChannel?.unsubscribe()
                conversationsChannel?.unsubscribe()
            } catch (e: Exception) {
                Timber.e(e, "Failed to unsubscribe")
            }
        }
    }

    /**
     * Register device for push notifications (Phase 4.5)
     *
     * Called when FCM generates a new device token.
     * Registers the device with the backend for push notification delivery.
     */
    suspend fun registerPushDevice(
        deviceToken: String,
        platform: String = "android"
    ): Boolean {
        return try {
            val userId = _currentUser.value ?: throw HelixError("AUTH_FAILED", "Not authenticated")
            val session = supabaseClient.auth.currentSessionOrNull()
                ?: throw HelixError("AUTH_FAILED", "No active session")

            val deviceData = mapOf(
                "device_id" to getDeviceId(),
                "user_id" to userId,
                "platform" to platform,
                "device_token" to deviceToken,
                "is_enabled" to true,
                "metadata" to mapOf(
                    "os_version" to android.os.Build.VERSION.SDK_INT,
                    "app_version" to getAppVersion(),
                    "manufacturer" to android.os.Build.MANUFACTURER,
                    "model" to android.os.Build.MODEL
                )
            )

            // Call register_push_device edge function via RPC
            supabaseClient.postgrest.rpc(
                "register_push_device",
                parameters = deviceData
            )

            // Save token locally for persistence
            savePushDeviceToken(deviceToken)
            Timber.d("Push device registered successfully (device: ${getDeviceId()})")

            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to register push device")
            // Don't throw - registration failure shouldn't break the app
            false
        }
    }

    /**
     * Unregister device from push notifications (called on sign out)
     */
    suspend fun unregisterPushDevice(): Boolean {
        return try {
            val userId = _currentUser.value ?: return true // Already logged out
            val session = supabaseClient.auth.currentSessionOrNull() ?: return true

            val deviceData = mapOf(
                "device_id" to getDeviceId(),
                "user_id" to userId
            )

            supabaseClient.postgrest.rpc(
                "unregister_push_device",
                parameters = deviceData
            )

            clearPushDeviceToken()
            Timber.d("Push device unregistered")

            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to unregister push device")
            false
        }
    }

    /**
     * Update notification preferences for current user
     */
    suspend fun updateNotificationPreferences(
        enablePush: Boolean = true,
        enableSound: Boolean = true,
        enableBadge: Boolean = true,
        quietHoursStart: String? = null,
        quietHoursEnd: String? = null,
        notifyOnTypes: List<String> = listOf("message", "mention")
    ): Boolean {
        return try {
            val userId = _currentUser.value ?: throw HelixError("AUTH_FAILED", "Not authenticated")

            val prefs = mapOf(
                "user_id" to userId,
                "enable_push" to enablePush,
                "enable_sound" to enableSound,
                "enable_badge" to enableBadge,
                "quiet_hours_start" to quietHoursStart,
                "quiet_hours_end" to quietHoursEnd,
                "notify_on_types" to notifyOnTypes,
                "max_notifications_per_hour" to 20
            )

            supabaseClient.postgrest.rpc(
                "update_notification_preferences",
                parameters = prefs
            )

            Timber.d("Notification preferences updated")
            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to update notification preferences")
            false
        }
    }

    /**
     * Get current notification preferences
     */
    suspend fun getNotificationPreferences(): Map<String, Any>? {
        return try {
            val userId = _currentUser.value ?: return null

            val result = supabaseClient.postgrest.from("notification_preferences")
                .select()
                .eq("user_id", userId)
                .decodeAs<Map<String, Any>>()

            result
        } catch (e: Exception) {
            Timber.e(e, "Failed to get notification preferences")
            null
        }
    }

    // Private helpers

    private suspend fun saveAuthToken(token: String) {
        dataStore.edit { preferences ->
            preferences[TOKEN_KEY] = token
        }
    }

    private suspend fun clearAuthToken() {
        dataStore.edit { preferences ->
            preferences.remove(TOKEN_KEY)
        }
    }

    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
    }

    private suspend fun savePushDeviceToken(token: String) {
        val PUSH_TOKEN_KEY = stringPreferencesKey("push_device_token")
        dataStore.edit { preferences ->
            preferences[PUSH_TOKEN_KEY] = token
        }
    }

    private suspend fun clearPushDeviceToken() {
        val PUSH_TOKEN_KEY = stringPreferencesKey("push_device_token")
        dataStore.edit { preferences ->
            preferences.remove(PUSH_TOKEN_KEY)
        }
    }

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        } catch (e: Exception) {
            "unknown"
        }
    }
}

/**
 * Helix Error
 */
data class HelixError(
    val code: String,
    val message: String
) : Exception(message)

// DataStore extension
private val Context.dataStore by preferencesDataStore(name = "helix_prefs")
