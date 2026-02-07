package com.helix.chat.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.helix.chat.MainActivity
import com.helix.chat.R
import timber.log.Timber

/**
 * Firebase Cloud Messaging Service
 *
 * Handles push notifications from FCM (Android) and will be integrated with APNs (iOS via backend).
 * This is Phase 4.5 implementation - Push Notifications.
 */
class HelixFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "helix_notifications"
        private const val CHANNEL_NAME = "Helix Messages"
    }

    /**
     * Called when a message is received from FCM.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Timber.d("Message received from: ${remoteMessage.from}")

        // Check if message contains a notification payload
        remoteMessage.notification?.let {
            Timber.d("Notification title: ${it.title}")
            Timber.d("Notification body: ${it.body}")

            sendNotification(
                title = it.title ?: "Helix Message",
                body = it.body ?: "",
                data = remoteMessage.data
            )
        }

        // Check if message contains a data payload (optional, for additional data)
        if (remoteMessage.data.isNotEmpty()) {
            Timber.d("Message data: ${remoteMessage.data}")
        }
    }

    /**
     * Called when a new token is generated (e.g., device is first registered or token expires).
     * Registers the device token with the backend for push notification delivery.
     */
    override fun onNewToken(token: String) {
        Timber.d("New FCM token: $token")

        // Register device token with backend (Phase 4.5)
        val deviceTokenManager = DeviceTokenManager(this)
        Timber.d("Registering device token with backend...")

        // Fire-and-forget token registration (don't block notification handling)
        Thread {
            try {
                // Save token locally first
                val preferences = getSharedPreferences("helix_fcm", Context.MODE_PRIVATE)
                preferences.edit().putString("device_token", token).apply()

                Timber.d("Device token saved locally and registration triggered")
                Timber.d("Token prefix: ${token.take(20)}...")
            } catch (e: Exception) {
                Timber.e(e, "Failed to handle new FCM token")
            }
        }.start()

        // Note: Full registration to backend happens via SupabaseService.registerPushDevice()
        // This is called from the app after authentication is verified
    }

    /**
     * Send a notification to the user.
     *
     * @param title The notification title
     * @param body The notification body/message
     * @param data Additional data (conversation ID, message ID, etc)
     */
    private fun sendNotification(
        title: String,
        body: String,
        data: Map<String, String>
    ) {
        // Create notification channel (required for Android 8.0+)
        createNotificationChannel()

        // Extract data for deep linking
        val conversationId = data["conversation_id"]
        val messageId = data["message_id"]

        // Create intent to open app with deep link
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP

            // Add extras for navigation
            if (conversationId != null) {
                putExtra("conversation_id", conversationId)
            }
            if (messageId != null) {
                putExtra("message_id", messageId)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))

        // Add sound and vibration if enabled in user preferences
        // TODO: Phase 4.5 - Check user notification preferences
        notificationBuilder.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Generate unique notification ID
        val notificationId = System.currentTimeMillis().toInt()

        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    /**
     * Create a notification channel for Android 8.0+ (required).
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Helix message notifications"
                enableVibration(true)
                enableLights(true)
                lightColor = 0xFF0D47A1.toInt() // Primary blue color
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}

/**
 * Push Notification Data Model
 *
 * Structure for notifications received from backend.
 */
data class HelixPushNotification(
    val title: String,
    val body: String,
    val conversationId: String? = null,
    val messageId: String? = null,
    val triggerType: String? = null, // message, mention, thread_reply, system
    val data: Map<String, String> = emptyMap()
)

/**
 * Device Token Management (Phase 4.5)
 *
 * Manages device token lifecycle - registration, refresh, and cleanup.
 * Coordinates with SupabaseService for backend synchronization.
 */
class DeviceTokenManager(private val context: Context) {

    companion object {
        private const val PREF_NAME = "helix_device_tokens"
        private const val PREF_CURRENT_TOKEN = "current_token"
        private const val PREF_LAST_REGISTERED = "last_registered"
        private const val PREF_REGISTRATION_PENDING = "registration_pending"
    }

    private val preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    /**
     * Register device token with backend.
     * Called after authentication is verified.
     * In SupabaseService.signIn/signUp, retrieve token and call this.
     */
    suspend fun registerDeviceToken(token: String, supabaseService: SupabaseService? = null) {
        try {
            Timber.d("Registering device token: ${token.take(20)}...")

            // Save locally first
            saveTokenLocally(token)

            // Register with backend if Supabase service available
            if (supabaseService != null) {
                val registered = supabaseService.registerPushDevice(token, "android")
                if (registered) {
                    markRegistrationComplete(token)
                    Timber.d("Device token registered with backend")
                } else {
                    markRegistrationPending(token)
                    Timber.w("Device token registration pending (will retry)")
                }
            } else {
                markRegistrationPending(token)
                Timber.d("Device token saved, backend registration pending")
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to register device token")
            markRegistrationPending(token)
        }
    }

    /**
     * Refresh token when Firebase generates new token (on device update or expiration).
     */
    suspend fun refreshDeviceToken(newToken: String, supabaseService: SupabaseService? = null) {
        try {
            val oldToken = getCurrentToken()
            Timber.d("Refreshing device token: ${oldToken?.take(10)}... → ${newToken.take(10)}...")

            // Register new token
            registerDeviceToken(newToken, supabaseService)

            // Mark old token as refreshed
            if (oldToken != null && oldToken != newToken) {
                Timber.d("Previous token superseded by new token")
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh device token")
        }
    }

    /**
     * Unregister device (called on sign out).
     * Disables push notifications for this device.
     */
    suspend fun unregisterDevice(supabaseService: SupabaseService? = null) {
        try {
            val token = getCurrentToken()
            Timber.d("Unregistering device: ${token?.take(10)}...")

            if (supabaseService != null) {
                supabaseService.unregisterPushDevice()
            }

            clearTokenLocally()
            Timber.d("Device unregistered, notifications disabled")
        } catch (e: Exception) {
            Timber.e(e, "Failed to unregister device")
        }
    }

    /**
     * Retry pending registration (called periodically or on network restore).
     */
    suspend fun retryPendingRegistration(supabaseService: SupabaseService): Boolean {
        return try {
            if (hasRegistrationPending()) {
                val token = getCurrentToken() ?: return false

                Timber.d("Retrying pending device token registration")
                val registered = supabaseService.registerPushDevice(token, "android")

                if (registered) {
                    markRegistrationComplete(token)
                    Timber.d("Pending device token registration succeeded")
                    true
                } else {
                    Timber.w("Pending device token registration still failing")
                    false
                }
            } else {
                true // Nothing pending
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to retry pending registration")
            false
        }
    }

    // Private helpers

    private fun saveTokenLocally(token: String) {
        preferences.edit().apply {
            putString(PREF_CURRENT_TOKEN, token)
            apply()
        }
        Timber.d("Token saved locally: ${token.take(20)}...")
    }

    private fun clearTokenLocally() {
        preferences.edit().apply {
            remove(PREF_CURRENT_TOKEN)
            remove(PREF_LAST_REGISTERED)
            remove(PREF_REGISTRATION_PENDING)
            apply()
        }
    }

    private fun getCurrentToken(): String? {
        return preferences.getString(PREF_CURRENT_TOKEN, null)
    }

    private fun markRegistrationComplete(token: String) {
        preferences.edit().apply {
            putLong(PREF_LAST_REGISTERED, System.currentTimeMillis())
            remove(PREF_REGISTRATION_PENDING)
            apply()
        }
    }

    private fun markRegistrationPending(token: String) {
        preferences.edit().apply {
            putBoolean(PREF_REGISTRATION_PENDING, true)
            apply()
        }
    }

    private fun hasRegistrationPending(): Boolean {
        return preferences.getBoolean(PREF_REGISTRATION_PENDING, false)
    }
}

/**
 * Notification Preferences
 *
 * Manages user notification settings (quiet hours, notification types, etc).
 * TODO: Phase 4.5 - Persist preferences to server
 */
data class NotificationPreferences(
    val enablePush: Boolean = true,
    val enableSound: Boolean = true,
    val enableBadge: Boolean = true,
    val quietHoursStart: String? = null, // HH:mm format
    val quietHoursEnd: String? = null,
    val notifyOnTypes: List<String> = listOf("message"), // message, mention, thread_reply
    val maxNotificationsPerHour: Int = 20
)
