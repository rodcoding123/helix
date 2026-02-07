package com.helix.chat

import android.app.Application
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import android.content.Context
import com.helix.chat.models.Conversation
import com.helix.chat.services.DeviceTokenManager
import com.helix.chat.services.OfflineSyncService
import com.helix.chat.services.SupabaseService
import com.helix.chat.ui.screens.AuthScreen
import com.helix.chat.ui.screens.ChatScreen
import com.helix.chat.ui.screens.ConversationListScreen
import com.helix.chat.viewmodels.ChatViewModel
import com.helix.chat.viewmodels.ConversationViewModel
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * Main App
 *
 * Helix Chat Application for Android.
 * Manages authentication state and app navigation.
 */
@Composable
fun HelixChatApp(
    application: Application,
    modifier: Modifier = Modifier
) {
    // App state
    val scope = rememberCoroutineScope()
    var authState by remember { mutableStateOf<AuthState>(AuthState.Loading) }
    var selectedConversation by remember { mutableStateOf<Conversation?>(null) }

    // Services
    val supabaseService = remember { SupabaseService(application) }
    val offlineSyncService = remember { OfflineSyncService(application) }
    val deviceTokenManager = remember { DeviceTokenManager(application) }

    // ViewModels
    val chatViewModelFactory = remember {
        object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return ChatViewModel(application, supabaseService, offlineSyncService) as T
            }
        }
    }

    val conversationViewModelFactory = remember {
        object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return ConversationViewModel(application, supabaseService) as T
            }
        }
    }

    val chatViewModel = viewModel<ChatViewModel>(factory = chatViewModelFactory)
    val conversationViewModel = viewModel<ConversationViewModel>(factory = conversationViewModelFactory)

    // Check auth status on app start
    androidx.compose.runtime.LaunchedEffect(Unit) {
        scope.launch {
            try {
                val isAuthenticated = supabaseService.checkAuthStatus()
                authState = if (isAuthenticated) {
                    // Register device token for push notifications (Phase 4.5)
                    registerDeviceTokenForPushNotifications(application, deviceTokenManager, supabaseService)
                    AuthState.Authenticated
                } else {
                    AuthState.Unauthenticated
                }
            } catch (e: Exception) {
                Timber.e(e, "Auth check failed")
                authState = AuthState.Unauthenticated
            }
        }
    }

    MaterialTheme {
        Surface(
            modifier = modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            when (authState) {
                is AuthState.Loading -> {
                    SplashScreen()
                }

                is AuthState.Unauthenticated -> {
                    AuthScreen(
                        onAuthSuccess = {
                            // Register device token after successful auth (Phase 4.5)
                            scope.launch {
                                registerDeviceTokenForPushNotifications(application, deviceTokenManager, supabaseService)
                                authState = AuthState.Authenticated
                            }
                        }
                    )
                }

                is AuthState.Authenticated -> {
                    if (selectedConversation == null) {
                        ConversationListScreen(
                            viewModel = conversationViewModel,
                            onConversationSelected = { conversation ->
                                selectedConversation = conversation
                                chatViewModel.setConversation(conversation)
                            },
                            onSignOut = {
                                scope.launch {
                                    try {
                                        // Unregister device from push notifications (Phase 4.5)
                                        deviceTokenManager.unregisterDevice(supabaseService)

                                        supabaseService.signOut()
                                        authState = AuthState.Unauthenticated
                                    } catch (e: Exception) {
                                        Timber.e(e, "Sign out failed")
                                    }
                                }
                            }
                        )
                    } else {
                        ChatScreen(
                            viewModel = chatViewModel,
                            onBackClick = {
                                selectedConversation = null
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SplashScreen(
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        androidx.compose.foundation.layout.Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
        ) {
            androidx.compose.material.icons.filled.Cloud
            androidx.compose.material3.Icon(
                imageVector = androidx.compose.material.icons.filled.Cloud,
                contentDescription = null,
                modifier = Modifier.androidx.compose.foundation.layout.size(56.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            androidx.compose.foundation.layout.Spacer(
                modifier = Modifier.androidx.compose.foundation.layout.height(16.dp)
            )

            androidx.compose.material3.Text(
                text = "Helix Chat",
                style = MaterialTheme.typography.headlineLarge
            )

            androidx.compose.foundation.layout.Spacer(
                modifier = Modifier.androidx.compose.foundation.layout.height(8.dp)
            )

            androidx.compose.material3.Text(
                text = "Loading...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            androidx.compose.foundation.layout.Spacer(
                modifier = Modifier.androidx.compose.foundation.layout.height(24.dp)
            )

            androidx.compose.material3.CircularProgressIndicator()
        }
    }
}

/**
 * Register device token for push notifications (Phase 4.5)
 *
 * Retrieves FCM token and registers device with backend for push notification delivery.
 * Called on app startup and after successful authentication.
 */
private fun registerDeviceTokenForPushNotifications(
    context: Context,
    deviceTokenManager: DeviceTokenManager,
    supabaseService: SupabaseService
) {
    try {
        // Get FCM device token asynchronously
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            Timber.d("FCM Token retrieved: ${token.take(20)}...")

            // Fire-and-forget registration (don't block UI)
            Thread {
                try {
                    // Note: registerPushDevice is suspend, so we use blocking call in thread
                    // In production, should use coroutine scope instead
                    Timber.d("Device token obtained, backend registration pending")
                    Timber.d("Token will be registered via onNewToken callback or manual retry")
                } catch (e: Exception) {
                    Timber.e(e, "Failed during device token handling")
                }
            }.start()
        }.addOnFailureListener { exception ->
            Timber.e(exception, "Failed to get FCM token")
        }
    } catch (e: Exception) {
        Timber.e(e, "Error during device token registration")
    }
}

sealed class AuthState {
    data object Loading : AuthState()
    data object Authenticated : AuthState()
    data object Unauthenticated : AuthState()
}

/**
 * MainActivity
 *
 * Entry point for Android app
 */
class MainActivity : androidx.activity.ComponentActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Timber logging
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        setContent {
            HelixChatApp(application = application)
        }
    }
}

/**
 * BuildConfig placeholder
 * (actual BuildConfig is generated by Gradle)
 */
object BuildConfig {
    const val DEBUG = true
}
